(() => {
  'use strict';

  const config = window.PHILLIC_DELETE_CONFIG ?? {};
  const signInForm = document.querySelector('#sign-in-form');
  const confirmation = document.querySelector('#confirmation');
  const confirmationInput = document.querySelector('#confirmation-input');
  const deleteButton = document.querySelector('#delete-button');
  const emailInput = document.querySelector('#email');
  const passwordInput = document.querySelector('#password');
  const status = document.querySelector('#status');
  const signedInEmail = document.querySelector('#signed-in-email');
  let accessToken = '';

  function configured() {
    try {
      const url = new URL(config.supabaseUrl);
      const key = String(config.supabasePublishableKey ?? '');
      return (
        url.protocol === 'https:' &&
        url.hostname.endsWith('.supabase.co') &&
        !String(config.supabaseUrl).startsWith('REPLACE_WITH_') &&
        key.length > 20 &&
        !key.startsWith('REPLACE_WITH_')
      );
    } catch {
      return false;
    }
  }

  function setStatus(message, kind = '') {
    status.textContent = message;
    status.className = `status${kind ? ` ${kind}` : ''}`;
  }

  function setBusy(isBusy) {
    for (const control of signInForm.querySelectorAll('input, button')) control.disabled = isBusy;
    confirmationInput.disabled = isBusy;
    deleteButton.disabled = isBusy || confirmationInput.value !== 'DELETE' || !accessToken;
  }

  async function parseResponse(response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error_description || body.msg || body.error || 'The request could not be completed.');
    }
    return body;
  }

  function clearSession() {
    accessToken = '';
    passwordInput.value = '';
    confirmationInput.value = '';
    deleteButton.disabled = true;
  }

  signInForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!configured()) {
      setStatus('Online account deletion is not configured yet. Please contact Phillic support.', 'error');
      return;
    }

    clearSession();
    setBusy(true);
    setStatus('Authenticating securely with Phillic…');

    try {
      const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: config.supabasePublishableKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: emailInput.value.trim().toLowerCase(),
          password: passwordInput.value,
        }),
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      const body = await parseResponse(response);
      accessToken = body.access_token;
      passwordInput.value = '';
      signedInEmail.textContent = body.user?.email || emailInput.value.trim().toLowerCase();
      signInForm.hidden = true;
      confirmation.hidden = false;
      setStatus('Account verified. Review the warning before deleting.', 'success');
    } catch (error) {
      clearSession();
      setStatus(error instanceof Error ? error.message : 'Authentication failed.', 'error');
    } finally {
      setBusy(false);
    }
  });

  confirmationInput.addEventListener('input', () => {
    deleteButton.disabled = confirmationInput.value !== 'DELETE' || !accessToken;
  });

  deleteButton.addEventListener('click', async () => {
    if (!accessToken || confirmationInput.value !== 'DELETE') return;
    setBusy(true);
    setStatus('Deleting the Phillic account…');

    try {
      const response = await fetch(`${config.supabaseUrl}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          apikey: config.supabasePublishableKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      await parseResponse(response);
      clearSession();
      confirmation.hidden = true;
      setStatus('Your Phillic account and RevenueCat customer record were deleted.', 'success');
    } catch (error) {
      clearSession();
      confirmation.hidden = true;
      signInForm.hidden = false;
      setStatus(
        `${error instanceof Error ? error.message : 'Deletion failed.'} Your Supabase account was not deleted. Sign in again to retry or contact support.`,
        'error'
      );
    } finally {
      setBusy(false);
    }
  });

  window.addEventListener('pagehide', clearSession);

  if (!configured()) {
    for (const control of signInForm.querySelectorAll('input, button')) control.disabled = true;
    setStatus('Online account deletion is awaiting production Supabase configuration.', 'error');
  }
})();
