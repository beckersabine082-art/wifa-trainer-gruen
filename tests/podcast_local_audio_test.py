import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('local_audio', Path(__file__).parents[1] / 'tools/podcast-sync/local_audio.py')
audio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audio)


class TimingTest(unittest.TestCase):
    def test_measured_samples_define_word_bounds_including_offset(self):
        words = [dict(wortIndex=0, wort='Ein'), dict(wortIndex=1, wort='Test')]
        self.assertEqual(audio.measured_marks(words, [(1, 3), (4, 5)], [10, 20, 30, 10, 40, 10], 100, 100), [
            dict(wortIndex=0, wort='Ein', start=1.1, end=1.6),
            dict(wortIndex=1, wort='Test', start=1.7, end=2.1)])

    def test_punctuation_is_not_lost_by_espeak(self):
        # eSpeak returns no phonemes for standalone punctuation. Preserve it directly.
        self.assertEqual(audio.gap_phonemes(': ', lambda _: []), [' ', ':', ' '])
        self.assertEqual(audio.gap_phonemes(' | ', lambda _: []), [' ', '.', ' '])

    def test_german_numeric_phrases_are_phonemized_as_one_value(self):
        words = [dict(wortIndex=0, wort='13', before='', after=','),
                 dict(wortIndex=1, wort='90', before='', after=' '),
                 dict(wortIndex=2, wort='Euro', before='', after='. ')]
        groups = audio.pronunciation_groups(words)
        self.assertEqual([g['text'] for g in groups], ['13,90', 'Euro'])
        words[0]['wort'] = '10'
        words[0]['after'] = '.'
        words[1]['wort'] = '000'
        self.assertEqual(audio.pronunciation_groups(words)[0]['text'], '10.000')


if __name__ == '__main__':
    unittest.main()
