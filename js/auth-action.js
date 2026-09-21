export function parseActionParams(search) {
  const params = new URLSearchParams(typeof search === 'string' ? search : '');
  return {
    mode: params.get('mode') || '',
    oobCode: params.get('oobCode') || ''
  };
}

export function getActionErrorMessage(error) {
  const code = error && typeof error.code === 'string' ? error.code : '';
  const messages = {
    'auth/expired-action-code': 'Dieser Link ist abgelaufen. Bitte fordere einen neuen Link an.',
    'auth/invalid-action-code': 'Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an.',
    'auth/user-disabled': 'Dieses Benutzerkonto ist deaktiviert.',
    'auth/user-not-found': 'Das zugehörige Benutzerkonto wurde nicht gefunden.',
    'auth/weak-password': 'Das Passwort ist zu kurz oder zu unsicher.',
    'auth/password-does-not-meet-requirements': 'Das Passwort erfüllt die erforderlichen Bedingungen nicht.',
    'auth/network-request-failed': 'Die Verbindung zu Firebase ist fehlgeschlagen. Bitte versuche es erneut.'
  };
  return messages[code] || 'Die Aktion konnte nicht ausgeführt werden. Bitte versuche es erneut.';
}

export function initAuthAction({ auth, applyActionCode, verifyPasswordResetCode, confirmPasswordReset }) {
  const params = parseActionParams(window.location.search);
  const status = document.querySelector('#actionStatus');
  const title = document.querySelector('#actionTitle');
  const resetForm = document.querySelector('#resetPasswordForm');
  const homeLink = document.querySelector('#homeLink');
  const loginLink = document.querySelector('#loginLink');
  const setStatus = (message, kind = 'error') => {
    status.textContent = message;
    status.className = `status ${kind}`;
    status.hidden = false;
  };
  const showHome = () => {
    homeLink.hidden = false;
    loginLink.hidden = true;
  };
  const showLogin = () => {
    homeLink.hidden = true;
    loginLink.hidden = false;
  };
  const missingCode = !params.oobCode;

  if (missingCode) {
    title.textContent = 'Link nicht verwendbar';
    setStatus('Der Link enthält keinen gültigen Aktionscode.');
    showHome();
    return;
  }

  if (params.mode === 'verifyEmail') {
    title.textContent = 'E-Mail-Adresse bestätigen';
    applyActionCode(auth, params.oobCode)
      .then(() => { setStatus('Deine E-Mail-Adresse wurde erfolgreich bestätigt.', 'success'); showHome(); })
      .catch(error => { setStatus(getActionErrorMessage(error)); showHome(); });
    return;
  }

  if (params.mode === 'recoverEmail') {
    title.textContent = 'E-Mail-Adresse wiederherstellen';
    applyActionCode(auth, params.oobCode)
      .then(() => { setStatus('Deine frühere E-Mail-Adresse wurde erfolgreich wiederhergestellt.', 'success'); showHome(); })
      .catch(error => { setStatus(getActionErrorMessage(error)); showHome(); });
    return;
  }

  if (params.mode === 'resetPassword') {
    title.textContent = 'Neues Passwort festlegen';
    verifyPasswordResetCode(auth, params.oobCode)
      .then(() => { resetForm.hidden = false; showLogin(); })
      .catch(error => { setStatus(getActionErrorMessage(error)); showHome(); });
    resetForm.addEventListener('submit', async event => {
      event.preventDefault();
      const password = document.querySelector('#newPassword').value;
      const confirmation = document.querySelector('#confirmPassword').value;
      if (password.length < 6) { setStatus('Das Passwort muss mindestens 6 Zeichen lang sein.'); return; }
      if (password !== confirmation) { setStatus('Die Passwörter stimmen nicht überein.'); return; }
      resetForm.querySelector('button').disabled = true;
      try {
        await confirmPasswordReset(auth, params.oobCode, password);
        resetForm.hidden = true;
        setStatus('Dein Passwort wurde erfolgreich geändert.', 'success');
        showLogin();
      } catch (error) {
        resetForm.querySelector('button').disabled = false;
        setStatus(getActionErrorMessage(error));
      }
    });
    return;
  }

  title.textContent = 'Unbekannte Aktion';
  setStatus('Dieser Link enthält keine unterstützte Firebase-Aktion.');
  showHome();
}
