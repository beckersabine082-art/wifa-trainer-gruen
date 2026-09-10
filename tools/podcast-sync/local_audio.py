"""Offline German synthesis with measured Piper phoneme durations; no network code."""
import argparse
import json
import re
import subprocess
import wave
from functools import lru_cache
from pathlib import Path

import imageio_ffmpeg
import numpy as np
import onnx
import onnxruntime
from piper import PiperVoice, SynthesisConfig
from piper.config import PiperConfig
from piper.patch_voice_with_alignment import add_alignment_output


def gap_phonemes(gap, phones):
    """eSpeak drops standalone punctuation: retain it in the Piper phoneme stream."""
    operators = {'§': 'Paragraf', '%': 'Prozent', '=': 'gleich',
                 '<': 'kleiner als', '>': 'größer als', '+': 'plus',
                 '−': 'minus', '·': 'mal', '/': 'durch', '€': 'Euro'}
    output = [' ']
    for symbol in gap:
        if symbol in operators:
            output.extend(phones(operators[symbol]))
            output.append(' ')
        elif symbol in '.,:;!?':
            output.append(symbol)
        elif symbol in '|\n' and (len(output) == 1 or output[-1] != '.'):
            output.append('.')
    if output[-1] != ' ':
        output.append(' ')
    return output


def measured_marks(words, spans, samples, sample_rate, offset):
    """Map recorded phoneme-ID ranges to measured samples, never estimated times."""
    cumulative = np.concatenate(([0], np.cumsum(samples)))
    return [dict(wortIndex=w['wortIndex'], wort=w['wort'],
                 start=(offset + int(cumulative[start])) / sample_rate,
                 end=(offset + int(cumulative[end])) / sample_rate)
            for w, (start, end) in zip(words, spans, strict=True)]


def pronunciation_groups(words):
    """Keep German thousands/decimal numbers intact despite DOM punctuation tokens."""
    groups = []
    i = 0
    while i < len(words):
        members = [words[i]]
        text = words[i]['wort']
        if text.isdigit():
            j = i
            while j + 1 < len(words) and words[j]['after'] in ('.', ',') and words[j + 1]['wort'].isdigit():
                separator = words[j]['after']
                following = words[j + 1]['wort']
                if separator == '.' and (len(following) != 3 or ',' in text):
                    break
                if separator == ',' and ',' in text:
                    break
                text += separator + following
                members.append(words[j + 1])
                j += 1
        groups.append(dict(text=text, members=members, before=members[0].get('before', ''), after=members[-1]['after']))
        i += len(members)
    return groups


def synthesize(voice, words, output):
    rate = voice.config.sample_rate
    id_map = voice.config.phoneme_id_map
    pad = list(id_map['_'])
    marks = []
    offset = 0
    peak = 0.0
    energy = 0.0

    @lru_cache(maxsize=8192)
    def phones(text):
        return [p for sentence in voice.phonemize(text) for p in sentence]

    def append_phones(ids, phonemes):
        for phoneme in phonemes:
            if phoneme not in id_map:
                raise ValueError(f'Unsupported phoneme: {phoneme!r}')
            ids.extend(id_map[phoneme])
            ids.extend(pad)

    def gap_phones(gap):
        return gap_phonemes(gap, phones)

    with wave.open(str(output), 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        batch = []

        def flush():
            nonlocal offset, peak, energy
            ids = list(id_map['^']) + pad
            spans = []
            batch_words = []
            for group in batch:
                if group['before']:
                    append_phones(ids, gap_phones(group['before']))
                phonemes = phones(group['text'])
                members = group['members']
                # A number such as 10.000 is a single spoken value but two DOM
                # tokens. Partition its measured phonemes among those tokens.
                # Ordinary words retain their complete, exact phoneme-ID span.
                for index, word in enumerate(members):
                    start = len(ids)
                    left = len(phonemes) * index // len(members)
                    right = len(phonemes) * (index + 1) // len(members)
                    append_phones(ids, phonemes[left:right])
                    spans.append((start, len(ids)))
                    batch_words.append(word)
                append_phones(ids, gap_phones(group['after']))
            ids.extend(id_map['$'])
            audio, durations = voice.phoneme_ids_to_audio(
                ids, SynthesisConfig(length_scale=1.05, noise_scale=0.667, noise_w_scale=0.8),
                include_alignments=True)
            if durations is None or len(durations) != len(ids):
                raise ValueError('Piper model does not supply phoneme alignments')
            if abs(int(sum(durations)) - len(audio)) > voice.config.hop_length:
                raise ValueError('Alignment/audio sample count mismatch')
            if not np.isfinite(audio).all() or len(audio) == 0:
                raise ValueError('Invalid PCM audio')
            marks.extend(measured_marks(batch_words, spans, durations, rate, offset))
            audio = np.clip(audio, -1.0, 1.0)
            peak = max(peak, float(np.max(np.abs(audio))))
            energy += float(np.sum(audio.astype(np.float64) ** 2))
            wav.writeframes((audio * 32767).astype('<i2').tobytes())
            offset += len(audio)
            batch.clear()

        for group in pronunciation_groups(words):
            batch.append(group)
            if re.search(r'[.!?\n|]', group['after']) or len(batch) >= 35:
                flush()
        if batch:
            flush()
    return dict(duration=offset / rate, peak=peak, rms=(energy / offset) ** 0.5,
                wortZeitmarken=marks, engine='piper-1.8.0', timing='phoneme-samples')


def main():
    parser = argparse.ArgumentParser()
    for name in ('model', 'input', 'output', 'result'):
        parser.add_argument('--' + name, required=True)
    args = parser.parse_args()
    data = json.loads(Path(args.input).read_text(encoding='utf-8-sig'))
    # Bound CPU use so several independent units can run on a Windows laptop.
    model = onnx.load(args.model)
    if len(model.graph.output) == 1:
        add_alignment_output(model)
    options = onnxruntime.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    voice = PiperVoice(
        config=PiperConfig.from_dict(json.loads(Path(args.model + '.json').read_text(encoding='utf-8'))),
        session=onnxruntime.InferenceSession(model.SerializeToString(), sess_options=options,
                                           providers=['CPUExecutionProvider']))
    wav_path = Path(args.output + '.wav')
    try:
        result = synthesize(voice, data['words'], wav_path)
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        subprocess.run([ffmpeg, '-nostdin', '-v', 'error', '-y', '-i', str(wav_path),
                        '-codec:a', 'libmp3lame', '-b:a', '96k', args.output], check=True,
                       capture_output=True)
        # Decode the entire MP3 before permitting publication, including its tail.
        decoded = subprocess.run([ffmpeg, '-nostdin', '-v', 'error', '-i', args.output,
                                  '-f', 's16le', '-ac', '1', '-ar', str(voice.config.sample_rate), '-'],
                                 check=True, capture_output=True)
        decoded_duration = len(decoded.stdout) / (2 * voice.config.sample_rate)
        if abs(decoded_duration - result['duration']) > 0.1:
            raise ValueError('MP3 duration changed during encoding')
        Path(args.result).write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    finally:
        wav_path.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
