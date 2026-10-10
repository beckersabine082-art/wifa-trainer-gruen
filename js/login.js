import {
	auth,
	db,
	onAuthStateChanged,
	setPersistence,
	browserLocalPersistence,
	browserSessionPersistence,
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
	sendEmailVerification,
	signOut,
	sendPasswordResetEmail,
	updateProfile,
	doc,
	getDoc,
	setDoc,
	serverTimestamp,
	updateDoc,
	getReturnUrl
} from './firebase-config.js';

// UI helpers
function $(id) { return document.getElementById(id); }

let currentUserVerified = false;
let authStateRevision = 0;

function getDesiredView() {
	return typeof window.desiredView === 'string' && document.getElementById(window.desiredView)
		? window.desiredView
		: null;
}

function clearDesiredView() {
	window.desiredView = null;
}

async function getDisplayName(user) {
	const authDisplayName = user && user.displayName ? user.displayName.trim() : '';
	if (authDisplayName) return authDisplayName;
	try {
		const profile = await getDoc(doc(db, 'users', user.uid));
		const profileDisplayName = profile.exists() ? profile.data().displayName : '';
		return typeof profileDisplayName === 'string' ? profileDisplayName.trim() : '';
	} catch (e) {
		logAuthDiagnostic('profile-read', e);
		return '';
	}
}

function getSafeDiagnosticCode(error) {
	const code = error && typeof error.code === 'string' ? error.code : '';
	return /^[a-z0-9._/-]{1,100}$/i.test(code) ? code : 'non-firebase-error';
}

function logAuthDiagnostic(stage, error) {
	console.warn('[WiFa Auth]', {
		stage,
		code: getSafeDiagnosticCode(error)
	});
}

function translateError(code) {
	const map = {
		'auth/email-already-in-use': 'Diese E-Mail-Adresse wird bereits verwendet.',
		'auth/invalid-email': 'Bitte gib eine gültige E-Mail-Adresse ein.',
		'auth/weak-password': 'Das Passwort ist zu kurz oder zu unsicher.',
		'auth/password-does-not-meet-requirements': 'Das Passwort erfüllt die erforderlichen Bedingungen nicht.',
		'auth/invalid-credential': 'E-Mail-Adresse oder Passwort stimmen nicht.',
		'auth/user-not-found': 'E-Mail oder Passwort falsch.',
		'auth/wrong-password': 'E-Mail oder Passwort falsch.',
		'auth/user-disabled': 'Dieses Konto kann derzeit nicht verwendet werden. Bitte wende dich an den Support.',
		'auth/too-many-requests': 'Zu viele Anmeldeversuche. Bitte später erneut versuchen.',
		'auth/network-request-failed': 'Netzwerkfehler. Bitte Verbindung prüfen.',
		'auth/web-storage-unsupported': 'Der Browserspeicher ist nicht verfügbar. Bitte prüfe die Browser-Einstellungen oder verwende ein normales Browserfenster.',
		'auth/operation-not-supported-in-this-environment': 'Die Anmeldung wird in dieser Browser-Umgebung nicht unterstützt.',
		'auth/operation-not-allowed': 'Die Anmeldung mit E-Mail und Passwort ist derzeit nicht verfügbar.',
		'auth/app-not-authorized': 'Die Anmeldung ist für diese Website derzeit nicht verfügbar.',
		'auth/invalid-api-key': 'Der Anmeldedienst ist derzeit nicht verfügbar.',
		'auth/internal-error': 'Der Anmeldedienst hat einen internen Fehler gemeldet. Bitte versuche es erneut.',
		'auth/no-current-user': 'Die Anmeldung konnte nicht bestätigt werden. Bitte versuche es erneut.'
	};
	return map[code] || 'Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.';
}

function getPasswordResetRequestPresentation(error) {
	const code = getSafeDiagnosticCode(error);
	if (code === 'auth/user-not-found') {
		return {
			message: 'Wenn die Adresse existiert, wurde eine E-Mail zum Zurücksetzen versendet.',
			error: false
		};
	}
	const resetMessages = {
		'auth/invalid-email': 'Bitte gib eine gültige E-Mail-Adresse ein.',
		'auth/too-many-requests': 'Zu viele Anfragen. Bitte warte etwas und versuche es später erneut.',
		'auth/network-request-failed': 'Netzwerkfehler. Die Reset-E-Mail konnte nicht angefordert werden. Bitte prüfe deine Verbindung.',
		'auth/unauthorized-continue-uri': 'Der Passwort-Reset ist derzeit nicht verfügbar. Bitte versuche es später erneut.',
		'auth/invalid-continue-uri': 'Der Passwort-Reset ist derzeit nicht verfügbar. Bitte versuche es später erneut.',
		'auth/missing-continue-uri': 'Der Passwort-Reset ist derzeit nicht verfügbar. Bitte versuche es später erneut.',
		'auth/operation-not-allowed': 'Der Passwort-Reset ist derzeit nicht verfügbar. Bitte versuche es später erneut.'
	};
	return {
		message: resetMessages[code] || 'Die Reset-E-Mail konnte nicht angefordert werden. Bitte versuche es erneut.',
		error: true
	};
}

function setBusy(flag) {
	const authControls = [
		'#authTabLogin',
		'#authTabRegister',
		'#authLoginForm button',
		'#authLoginForm input',
		'#authRegisterForm button',
		'#authRegisterForm input',
		'#authProfile button',
		'#authProfile input'
	].join(', ');
	document.querySelectorAll(authControls).forEach(el => {
		el.disabled = flag;
		el.style.opacity = flag ? '0.6' : '';
		el.style.cursor = flag ? 'wait' : '';
	});
}

function showStatus(msg, error=false) {
	const el = $('authStatus');
	el.textContent = msg;
	el.hidden = !msg;
	el.style.color = error ? '#a12d2d' : '';
}

export function requireAuth(target) {
	// SECURITY: only trust Firebase auth.currentUser and its emailVerified flag
	const user = auth && auth.currentUser ? auth.currentUser : null;
	if (!user) {
		// not signed in
		window.desiredView = target;
		try { zeigeBereich('authView'); } catch (e) { console.warn('zeigeBereich authView failed', e); }
		return;
	}
	if (user.emailVerified !== true) {
		// signed in but not email-verified
		window.desiredView = target;
		try { zeigeBereich('authView'); } catch (e) { console.warn('zeigeBereich authView failed', e); }
		return;
	}
	// signed in and email-verified: set canonical UID and navigate
	try { window.aktuellerNutzer = user.uid; } catch (e) { console.warn('setting aktuellerNutzer failed', e); }
	try { zeigeBereich(target); } catch (e) { console.warn('zeigeBereich failed', e); }
	try { if (typeof closeMainMenu === 'function') closeMainMenu(); } catch (e) {}
}

async function ensureUserProfile(user) {
	try {
		const uref = doc(db, 'users', user.uid);
		const snap = await getDoc(uref);
		if (!snap.exists()) {
			await setDoc(uref, {
				displayName: user.displayName || '',
				createdAt: serverTimestamp(),
				updatedAt: serverTimestamp()
			});
		}
	} catch (e) {
		logAuthDiagnostic('profile-ensure', e);
	}
}

function updateNavForAuth(user) {
	const authBtn = $('navAuth');
	const authLabel = $('navAuthLabel');
	if (!authBtn) return;
	if (authLabel) {
		if (!user) {
			authLabel.textContent = 'Anmelden';
		} else if (user.emailVerified !== true) {
			authLabel.textContent = 'Konto bestätigen';
		} else {
			authLabel.textContent = 'Mein Konto';
		}
	} else if (user && user.emailVerified) {
		authBtn.textContent = 'Mein Konto';
	} else if (user) {
		authBtn.textContent = 'Konto bestätigen';
	} else {
		authBtn.textContent = 'Anmelden';
	}
}

function updateGreetingForStart(user, displayName = '') {
	const el = $('startUserGreeting');
	if (!el) return;
	if (user && user.emailVerified === true) {
		el.replaceChildren();
		if (displayName) {
			const salutation = document.createElement('span');
			salutation.className = 'start-user-name';
			salutation.textContent = `Hallo ${displayName}`;
			const welcome = document.createElement('span');
			welcome.className = 'start-user-welcome';
			welcome.textContent = ', schön, dass du da bist.';
			el.append(salutation, welcome);
		} else {
			el.textContent = 'Willkommen zurück';
		}
		el.hidden = false;
	} else {
		el.textContent = '';
		el.hidden = true;
	}
}

function updateAuthTitle(user) {
	const title = $('authViewTitle');
	if (!title) return;
	if (!user) {
		title.textContent = 'Anmelden / Registrieren';
	} else if (user.emailVerified !== true) {
		title.textContent = 'E-Mail-Adresse bestätigen';
	} else {
		title.textContent = 'Mein Konto';
	}
}

function updateProfileArea(user, displayName = '') {
	const authProfile = $('authProfile');
	const profileGreeting = $('profileGreeting');
	const profileDisplayName = $('profileDisplayName');
	const profileDisplayNameInput = $('profileDisplayNameInput');
	const profileEmail = $('profileEmail');
	const profileEmailVerified = $('profileEmailVerified');
	const resend = $('resendVerificationBtn');
	const check = $('checkVerificationBtn');
	if (!authProfile || !profileGreeting || !profileDisplayName || !profileDisplayNameInput || !profileEmail || !profileEmailVerified) return;
	if (!user) {
		authProfile.style.display = 'none';
		profileGreeting.textContent = '';
		profileDisplayName.textContent = '';
		profileDisplayNameInput.value = '';
		profileEmail.textContent = '';
		profileEmailVerified.textContent = '';
		if (resend) resend.style.display = 'none';
		if (check) check.style.display = 'none';
		return;
	}
	profileGreeting.textContent = user.emailVerified === true
		? (displayName ? `Hallo ${displayName}` : 'Willkommen zurück')
		: '';
	profileDisplayName.textContent = displayName || 'Kein Nutzername hinterlegt';
	profileDisplayNameInput.value = displayName;
	const editArea = $('displayNameEditArea');
	const editButton = $('editDisplayNameBtn');
	if (editArea) editArea.hidden = true;
	if (editButton) editButton.hidden = false;
	profileEmail.textContent = `E-Mail: ${user.email || ''}`;
	profileEmailVerified.textContent = user.emailVerified ? 'E-Mail bestätigt' : 'E-Mail noch nicht bestätigt';
	profileEmailVerified.classList.toggle('is-verified', user.emailVerified === true);
	if (user.emailVerified === true) {
		authProfile.style.display = '';
		if (resend) resend.style.display = 'none';
		if (check) check.style.display = 'none';
	} else {
		authProfile.style.display = '';
		if (resend) resend.style.display = '';
		if (check) check.style.display = '';
	}
}

function showAuthenticatedAccount(user, displayName = '') {
	updateAuthTitle(user);
	updateProfileArea(user, displayName);
	const authLoginForm = $('authLoginForm');
	const authRegisterForm = $('authRegisterForm');
	const tabs = document.querySelector('#authView .auth-tabs');
	if (authLoginForm) authLoginForm.style.display = 'none';
	if (authRegisterForm) authRegisterForm.style.display = 'none';
	if (tabs) tabs.style.display = 'none';
}

async function openAuthArea() {
	showStatus('');
	const user = auth.currentUser;
	if (user && user.emailVerified === true) {
		showAuthenticatedAccount(user, user.displayName ? user.displayName.trim() : '');
		zeigeBereich('authView');
		const displayName = await getDisplayName(user);
		if (auth.currentUser === user && user.emailVerified === true) {
			showAuthenticatedAccount(user, displayName);
		}
	} else {
		zeigeBereich('authView');
	}
	if (typeof closeMainMenu === 'function') closeMainMenu();
}

function setLoggedOutAuthState() {
	if (typeof window.trainerPilotPoolCacheLeeren === 'function') window.trainerPilotPoolCacheLeeren();
	window.aktuellerNutzer = null;
	clearDesiredView();
	showStatus('');
	updateGreetingForStart(null);
	updateNavForAuth(null);
	updateAuthTitle(null);
	updateProfileArea(null);

	const loginTab = $('authTabLogin');
	const registerTab = $('authTabRegister');
	if (loginTab) {
		loginTab.classList.add('active');
		loginTab.disabled = false;
	}
	if (registerTab) {
		registerTab.classList.remove('active');
		registerTab.disabled = false;
	}

	const authLoginForm = $('authLoginForm');
	if (authLoginForm) authLoginForm.style.display = '';
	const authRegisterForm = $('authRegisterForm');
	if (authRegisterForm) authRegisterForm.style.display = 'none';
	const authProfile = $('authProfile');
	if (authProfile) authProfile.style.display = 'none';
	const tabs = document.querySelector('#authView .auth-tabs');
	if (tabs) tabs.style.display = '';

	const privacy = $('regPrivacyAcknowledged');
	if (privacy) privacy.checked = false;
	const loginEmail = $('loginEmail');
	if (loginEmail) loginEmail.value = '';
	const loginPassword = $('loginPassword');
	if (loginPassword) loginPassword.value = '';
	const regDisplayName = $('regDisplayName');
	if (regDisplayName) regDisplayName.value = '';
	const regEmail = $('regEmail');
	if (regEmail) regEmail.value = '';
	const regPassword = $('regPassword');
	if (regPassword) regPassword.value = '';
	const regPasswordConfirm = $('regPasswordConfirm');
	if (regPasswordConfirm) regPasswordConfirm.value = '';
}

function bindAuthUI() {
	const loginTab = $('authTabLogin');
	const registerTab = $('authTabRegister');
	if (!loginTab || !registerTab) return;
	if (loginTab.dataset.authBound === '1') return;
	loginTab.dataset.authBound = '1';
	registerTab.dataset.authBound = '1';

	loginTab.addEventListener('click', () => {
		loginTab.classList.add('active');
		registerTab.classList.remove('active');
		const authLoginForm = $('authLoginForm');
		if (authLoginForm) authLoginForm.style.display = '';
		const authRegisterForm = $('authRegisterForm');
		if (authRegisterForm) authRegisterForm.style.display = 'none';
		const authProfile = $('authProfile');
		if (authProfile) authProfile.style.display = 'none';
		const tabs = document.querySelector('#authView .auth-tabs');
		if (tabs) tabs.style.display = '';
		if ($('regPassword')) $('regPassword').value = '';
		if ($('regPasswordConfirm')) $('regPasswordConfirm').value = '';
		showStatus('');
	});

	registerTab.addEventListener('click', () => {
		loginTab.classList.remove('active');
		registerTab.classList.add('active');
		const authLoginForm = $('authLoginForm');
		if (authLoginForm) authLoginForm.style.display = 'none';
		const authRegisterForm = $('authRegisterForm');
		if (authRegisterForm) authRegisterForm.style.display = '';
		const authProfile = $('authProfile');
		if (authProfile) authProfile.style.display = 'none';
		const tabs = document.querySelector('#authView .auth-tabs');
		if (tabs) tabs.style.display = '';
		const terms = $('regTermsAccepted');
		if (terms) terms.checked = false;
		const privacy = $('regPrivacyAcknowledged');
		if (privacy) privacy.checked = false;
		const status = $('authStatus');
		if (status && (status.textContent === 'Bitte akzeptiere zuerst die Nutzungsbedingungen.' || status.textContent === 'Bitte bestätigen Sie, dass Sie die Datenschutzerklärung zur Kenntnis genommen haben.')) {
			status.textContent = '';
		}
	});

	const loginForm = $('authLoginForm');
	if (loginForm) loginForm.addEventListener('submit', async (event) => {
		event.preventDefault();
		const email = $('loginEmail').value.trim().toLowerCase();
		const password = $('loginPassword').value;
		const remember = $('loginRemember').checked;
		if (!email || !password) { showStatus('Bitte E-Mail und Passwort eingeben.', true); return; }
		setBusy(true); showStatus('Anmeldung...');
		try {
			try {
				await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
			} catch (error) {
				logAuthDiagnostic('persistence', error);
				showStatus(translateError(error && error.code), true);
				return;
			}

			let credential;
			try {
				credential = await signInWithEmailAndPassword(auth, email, password);
			} catch (error) {
				logAuthDiagnostic('sign-in', error);
				showStatus(translateError(error && error.code), true);
				return;
			}

			const user = credential && credential.user ? credential.user : auth.currentUser;
			if (!user) {
				const error = { code: 'auth/no-current-user' };
				logAuthDiagnostic('sign-in-result', error);
				showStatus(translateError(error.code), true);
				return;
			}
			currentUserVerified = !!user.emailVerified;
			if (!currentUserVerified) {
				showStatus('E-Mail-Adresse noch nicht bestätigt. Bitte prüfen Sie Ihr Postfach.', true);
				return;
			}

			window.aktuellerNutzer = user.uid;
			showStatus('Erfolgreich angemeldet.');
			const target = getDesiredView() || 'startView';
			clearDesiredView();
			try {
				zeigeBereich(target);
			} catch (error) {
				logAuthDiagnostic('post-auth-navigation', error);
				try {
					showAuthenticatedAccount(user, user.displayName ? user.displayName.trim() : '');
					zeigeBereich('authView');
				} catch (recoveryError) {
					logAuthDiagnostic('post-auth-recovery', recoveryError);
				}
				showStatus('Die Anmeldung war erfolgreich, aber der gewünschte Bereich konnte nicht geöffnet werden. Bitte lade die Seite neu.', true);
				return;
			}
			if (target === 'trainerView') {
				Promise.resolve().then(() => window.trainerEinstiegNachAuth?.()).catch(error => {
					logAuthDiagnostic('trainer-entry', error);
				});
			}
		} catch (e) {
			logAuthDiagnostic('login-unexpected', e);
			showStatus('Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.', true);
		} finally { setBusy(false); }
	});

	const registerForm = $('authRegisterForm');
	if (registerForm) registerForm.addEventListener('submit', async (event) => {
		event.preventDefault();
		const displayName = $('regDisplayName').value.trim();
		const email = $('regEmail').value.trim().toLowerCase();
		const terms = $('regTermsAccepted');
		const pw = $('regPassword').value;
		const pw2 = $('regPasswordConfirm').value;
		if (!displayName || displayName.length > 50) { showStatus('Bitte einen Anzeigenamen (max. 50 Zeichen) eingeben.', true); return; }
		if (!email) { showStatus('Bitte eine gültige E-Mail-Adresse eingeben.', true); return; }
		if (!terms || !terms.checked) {
			showStatus('Bitte akzeptiere zuerst die Nutzungsbedingungen.', true);
			return;
		}
		if (pw.length < 12) { showStatus('Das Passwort muss mindestens 12 Zeichen lang sein.', true); return; }
		if (!(pw === pw2)) { showStatus('Die Passwörter stimmen nicht überein.', true); return; }

		setBusy(true); showStatus('Registrierung läuft...');
		try {
			const cred = await createUserWithEmailAndPassword(auth, email, pw);
			await updateProfile(cred.user, { displayName });
			await sendEmailVerification(cred.user, { url: getReturnUrl() });
			await signOut(auth);
			const regTerms = $('regTermsAccepted');
			if (regTerms) regTerms.checked = false;
			const regPrivacy = $('regPrivacyAcknowledged');
			if (regPrivacy) regPrivacy.checked = false;
			showStatus('Registrierung erfolgreich. Bitte bestätigen Sie die E-Mail, bevor Sie sich anmelden.');
		} catch (e) {
			logAuthDiagnostic('registration', e);
			showStatus(translateError(e.code), true);
		} finally { setBusy(false); }
	});

	if ($('regPassword')) {
		$('regPassword').addEventListener('input', () => {
			const s = $('authStatus').textContent || '';
			if (s.indexOf('Die Passwörter stimmen nicht überein') === 0) showStatus('');
		});
	}
	if ($('regPasswordConfirm')) {
		$('regPasswordConfirm').addEventListener('input', () => {
			const s = $('authStatus').textContent || '';
			if (s.indexOf('Die Passwörter stimmen nicht überein') === 0) showStatus('');
		});
	}

	const regBack = $('regBackStart');
	if (regBack) {
		regBack.addEventListener('click', (ev) => {
			ev.preventDefault();
			if ($('regPassword')) $('regPassword').value = '';
			if ($('regPasswordConfirm')) $('regPasswordConfirm').value = '';
			const privacy = $('regPrivacyAcknowledged');
			if (privacy) privacy.checked = false;
			showStatus('');
			const tabs = document.querySelector('#authView .auth-tabs'); if (tabs) tabs.style.display = '';
			zeigeBereich('startView');
			if (typeof closeMainMenu === 'function') closeMainMenu();
		});
	}

	const loginBack = $('loginBackStart');
	if (loginBack) {
		loginBack.addEventListener('click', (ev) => {
			ev.preventDefault();
			if ($('loginEmail')) $('loginEmail').value = '';
			if ($('loginPassword')) $('loginPassword').value = '';
			showStatus('');
			const tabs = document.querySelector('#authView .auth-tabs'); if (tabs) tabs.style.display = '';
			zeigeBereich('startView');
			if (typeof closeMainMenu === 'function') closeMainMenu();
		});
	}

	const privacyInput = $('regPrivacyAcknowledged');
	if (privacyInput) {
		privacyInput.addEventListener('input', () => {
			const status = $('authStatus');
			if (status && status.textContent === 'Bitte bestätigen Sie, dass Sie die Datenschutzerklärung zur Kenntnis genommen haben.') {
				showStatus('');
			}
		});
	}

	const termsInput = $('regTermsAccepted');
	if (termsInput) {
		termsInput.addEventListener('input', () => {
			const status = $('authStatus');
			if (status && status.textContent === 'Bitte akzeptiere zuerst die Nutzungsbedingungen.') {
				showStatus('');
			}
		});
	}

	const profileBack = $('profileBackStart');
	if (profileBack) {
		profileBack.addEventListener('click', (ev) => {
			ev.preventDefault();
			showStatus('');
			const tabs = document.querySelector('#authView .auth-tabs'); if (tabs) tabs.style.display = '';
			zeigeBereich('startView');
			if (typeof closeMainMenu === 'function') closeMainMenu();
		});
	}

	$('forgotPasswordBtn').addEventListener('click', async () => {
		const email = $('loginEmail').value.trim().toLowerCase();
		if (!email) { showStatus('Bitte E-Mail in das Anmeldeformular eingeben.', true); return; }
		setBusy(true); showStatus('Sende Passwort-Zurücksetzung...');
		try {
			await sendPasswordResetEmail(auth, email, { url: getReturnUrl() });
			showStatus('Wenn die Adresse existiert, wurde eine E-Mail zum Zurücksetzen versendet.');
		} catch (e) {
			logAuthDiagnostic('password-reset-request', e);
			const presentation = getPasswordResetRequestPresentation(e);
			showStatus(presentation.message, presentation.error);
		} finally { setBusy(false); }
	});

	$('resendVerificationBtn').addEventListener('click', async () => {
		const user = auth.currentUser;
		if (!user) { showStatus('Kein angemeldeter Nutzer.', true); return; }
		setBusy(true); showStatus('Sende Bestätigungs-E-Mail...');
		try {
			await sendEmailVerification(user, { url: getReturnUrl() });
			showStatus('Bestätigungs-E-Mail erneut gesendet.');
		} catch (e) {
			logAuthDiagnostic('verification-email-resend', e);
			showStatus('Fehler beim Senden der E-Mail.', true);
		}
		finally { setBusy(false); }
	});

	$('checkVerificationBtn').addEventListener('click', async () => {
		const user = auth.currentUser;
		if (!user) { showStatus('Kein angemeldeter Nutzer.', true); return; }
		setBusy(true);
		try {
			await user.reload();
			if (user.emailVerified) {
				try { await user.getIdToken(true); } catch(e) { logAuthDiagnostic('verification-token-refresh', e); }
				currentUserVerified = true;
				window.aktuellerNutzer = user.uid;
				showStatus('E-Mail bestätigt. Zugriff freigeschaltet.');
				updateNavForAuth(user);
				await ensureUserProfile(user);
				const target = getDesiredView();
				if (target) {
					zeigeBereich(target);
					if (target === 'trainerView') window.trainerEinstiegNachAuth?.();
					clearDesiredView();
				}
			} else {
				showStatus('E-Mail noch nicht bestätigt.', true);
			}
		} catch (e) {
			logAuthDiagnostic('verification-status-check', e);
			showStatus('Fehler beim Prüfen des Bestätigungsstatus.', true);
		} finally { setBusy(false); }
	});

	$('signOutBtn').addEventListener('click', async () => {
		setBusy(true); showStatus('Abmelden...');
		try {
			await signOut(auth);
			window.aktuellerNutzer = null;
			clearDesiredView();
			setLoggedOutAuthState();
			zeigeBereich('startView');
		} catch (e) {
			logAuthDiagnostic('sign-out', e);
			showStatus('Fehler beim Abmelden.', true);
		}
		finally { setBusy(false); }
	});

	const passwordResetBtn = $('accountPasswordResetBtn');
	if (passwordResetBtn) {
		passwordResetBtn.addEventListener('click', async () => {
			const user = auth.currentUser;
			if (!user || !user.email) {
				showStatus('Kein angemeldeter Nutzer.', true);
				return;
			}
			setBusy(true);
			try {
				await sendPasswordResetEmail(auth, user.email, { url: getReturnUrl() });
				showStatus('Wir haben dir eine E-Mail zum Ändern deines Passworts gesendet.');
			} catch (e) {
				logAuthDiagnostic('account-password-reset-request', e);
				const presentation = getPasswordResetRequestPresentation(e);
				showStatus(presentation.message, presentation.error);
			} finally {
				setBusy(false);
			}
		});
	}

	const feedbackToggle = $('feedbackToggle');
	const feedbackPanel = $('feedbackPanel');
	const feedbackText = $('feedbackText');
	const feedbackSend = $('feedbackSend');
	const feedbackStatus = $('feedbackStatus');
	if (feedbackToggle && feedbackPanel && feedbackText && feedbackSend && feedbackStatus) {
		feedbackToggle.addEventListener('click', () => {
			const expanded = feedbackToggle.getAttribute('aria-expanded') === 'true';
			feedbackToggle.setAttribute('aria-expanded', String(!expanded));
			feedbackPanel.hidden = expanded;
			if (!expanded) feedbackText.focus();
		});

		feedbackText.addEventListener('input', () => {
			feedbackText.style.height = 'auto';
			feedbackText.style.height = Math.min(feedbackText.scrollHeight, 240) + 'px';
			feedbackText.style.overflowY = feedbackText.scrollHeight > 240 ? 'auto' : 'hidden';
		});

		feedbackSend.addEventListener('click', async () => {
			const feedback = feedbackText.value.trim();
			if (!feedback) {
				feedbackStatus.textContent = 'Bitte gib zuerst dein Feedback ein.';
				feedbackStatus.dataset.error = 'true';
				feedbackStatus.hidden = false;
				feedbackText.focus();
				return;
			}
			if (feedback.length > 3000 || feedbackSend.disabled) return;
			feedbackSend.disabled = true;
			feedbackStatus.hidden = true;
			try {
				const activeView = document.querySelector('.view.active');
				const result = await window.apiPost('sendFeedback', {
					feedback,
					page: `${location.pathname}${location.hash}${activeView ? ` | ${activeView.id}` : ''}`.slice(0, 300)
				});
				if (!result || result.success !== true) throw new Error(result && result.error || 'request_failed');
				feedbackText.value = '';
				feedbackText.style.height = '';
				feedbackText.style.overflowY = 'hidden';
				feedbackStatus.textContent = 'Danke! Dein Feedback wurde gesendet.';
				feedbackStatus.dataset.error = 'false';
			} catch (error) {
				const messages = {
					unauthenticated: 'Bitte melde dich mit einem bestätigten Konto an und versuche es erneut.',
					invalid_request: 'Das Feedback ist ungültig oder zu lang. Bitte prüfe deine Eingabe.',
					rate_limited: 'Du hast gerade sehr viele Anfragen gesendet. Bitte versuche es später erneut.',
					unavailable: 'Der Feedbackversand ist gerade nicht verfügbar. Bitte versuche es später erneut.'
				};
				feedbackStatus.textContent = messages[error && error.message] || 'Feedback konnte nicht gesendet werden. Bitte prüfe deine Verbindung und versuche es erneut.';
				feedbackStatus.dataset.error = 'true';
			} finally {
				feedbackStatus.hidden = false;
				feedbackSend.disabled = false;
			}
		});
	}

	const saveDisplayNameBtn = $('saveDisplayNameBtn');
	if (saveDisplayNameBtn) {
		saveDisplayNameBtn.addEventListener('click', async () => {
			const user = auth.currentUser;
			const input = $('profileDisplayNameInput');
			const displayName = input ? input.value.trim() : '';
			if (!user || user.emailVerified !== true) {
				showStatus('Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.', true);
				return;
			}
			if (!displayName || displayName.length > 50) {
				showStatus('Bitte einen Anzeigenamen mit 1 bis 50 Zeichen eingeben.', true);
				return;
			}
			setBusy(true);
			try {
				await updateProfile(user, { displayName });
				await updateDoc(doc(db, 'users', user.uid), {
					displayName,
					updatedAt: serverTimestamp()
				});
				updateGreetingForStart(user, displayName);
				updateProfileArea(user, displayName);
				updateNavForAuth(user);
				showStatus('Anzeigename gespeichert.');
			} catch (e) {
				logAuthDiagnostic('profile-update', e);
				showStatus('Anzeigename konnte nicht gespeichert werden. Bitte erneut versuchen.', true);
			} finally {
				setBusy(false);
			}
		});
	}

	const editDisplayNameBtn = $('editDisplayNameBtn');
	if (editDisplayNameBtn) {
		editDisplayNameBtn.addEventListener('click', () => {
			const editArea = $('displayNameEditArea');
			const input = $('profileDisplayNameInput');
			if (editArea) editArea.hidden = false;
			editDisplayNameBtn.hidden = true;
			if (input) input.focus();
		});
	}

	const cancelDisplayNameBtn = $('cancelDisplayNameBtn');
	if (cancelDisplayNameBtn) {
		cancelDisplayNameBtn.addEventListener('click', () => {
			const editArea = $('displayNameEditArea');
			const input = $('profileDisplayNameInput');
			const displayName = $('profileDisplayName').textContent;
			if (input) input.value = displayName === 'Kein Nutzername hinterlegt' ? '' : displayName;
			if (editArea) editArea.hidden = true;
			const editButton = $('editDisplayNameBtn');
			if (editButton) editButton.hidden = false;
		});
	}
}

function isCurrentAuthState(user, revision) {
	return revision === authStateRevision
		&& !!(user && auth.currentUser && auth.currentUser.uid === user.uid);
}

onAuthStateChanged(auth, async (user) => {
	const revision = ++authStateRevision;
	if (user && user.uid) {
		if (!isCurrentAuthState(user, revision)) return;
		currentUserVerified = !!user.emailVerified;
		if (currentUserVerified) {
			try { await user.getIdToken(true); } catch (e) { logAuthDiagnostic('auth-state-token-refresh', e); }
			if (!isCurrentAuthState(user, revision)) return;
			window.aktuellerNutzer = user.uid;
			await ensureUserProfile(user);
			if (!isCurrentAuthState(user, revision)) return;
		} else {
			window.aktuellerNutzer = null;
		}
		const displayName = await getDisplayName(user);
		if (!isCurrentAuthState(user, revision)) return;
		updateGreetingForStart(user, displayName);
		updateNavForAuth(user);
		if (currentUserVerified) {
			showAuthenticatedAccount(user, displayName);
		} else {
			updateAuthTitle(user);
			updateProfileArea(user, displayName);
		}

		const loginTab = $('authTabLogin');
		const registerTab = $('authTabRegister');
		if (loginTab) { loginTab.classList.remove('active'); loginTab.disabled = true; }
		if (registerTab) { registerTab.classList.remove('active'); registerTab.disabled = true; }

		if (!currentUserVerified) {
			const authProfile = $('authProfile');
			if (authProfile) authProfile.style.display = '';
			const authLoginForm = $('authLoginForm');
			if (authLoginForm) authLoginForm.style.display = 'none';
			const authRegisterForm = $('authRegisterForm');
			if (authRegisterForm) authRegisterForm.style.display = 'none';
			const tabs = document.querySelector('#authView .auth-tabs');
			if (tabs) tabs.style.display = 'none';
		}
		const target = getDesiredView();
		if (currentUserVerified && target) {
			try {
				zeigeBereich(target);
				if (target === 'trainerView') {
					Promise.resolve().then(() => window.trainerEinstiegNachAuth?.()).catch(error => {
						logAuthDiagnostic('trainer-entry', error);
					});
				}
			} catch (error) {
				logAuthDiagnostic('auth-state-navigation', error);
				try {
					showAuthenticatedAccount(user, displayName);
					zeigeBereich('authView');
				} catch (recoveryError) {
					logAuthDiagnostic('auth-state-recovery', recoveryError);
				}
				showStatus('Die Anmeldung war erfolgreich, aber der gewünschte Bereich konnte nicht geöffnet werden. Bitte lade die Seite neu.', true);
			} finally {
				clearDesiredView();
			}
		}
		if (currentUserVerified && typeof window.stelleLaufendePruefungWiederHer === 'function') {
			try {
				await window.stelleLaufendePruefungWiederHer();
			} catch (error) {
				logAuthDiagnostic('post-auth-session-restore', error);
			}
			if (!isCurrentAuthState(user, revision)) return;
		}
	} else {
		window.aktuellerNutzer = null;
		currentUserVerified = false;
		setLoggedOutAuthState();
	}
	if (typeof window.authInitialized === 'undefined') window.authInitialized = true;
	window.requireAuthReal = requireAuth;
});

window.requireAuth = requireAuth;
window.openAuthArea = openAuthArea;

document.addEventListener('DOMContentLoaded', async () => {
	bindAuthUI();
	if (window.location && window.location.hash === '#auth') {
		try {
			await openAuthArea();
		} catch (error) {
			logAuthDiagnostic('auth-link-navigation', error);
			showStatus('Der Anmeldebereich konnte nicht automatisch geöffnet werden. Bitte verwende die Schaltfläche „Anmelden“.', true);
		}
	}
}, { once: true });

