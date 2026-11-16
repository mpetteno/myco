export function authErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  switch (code) {
    case 'invalid_credentials': return 'The email or password is incorrect.';
    case 'email_not_confirmed': return 'Confirm your email address before signing in.';
    case 'user_already_exists': return 'An account with this email may already exist. Try signing in.';
    case 'weak_password':
      return error instanceof Error ? error.message : 'Choose a stronger password and try again.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit': return 'Too many attempts. Wait a little, then try again.';
    case 'signup_disabled': return 'New accounts are not available right now.';
    case 'email_address_invalid': return 'Enter a valid email address.';
    case 'email_address_not_authorized': return 'Account emails cannot be sent to this address yet. Please contact the app owner.';
  }
  if (error instanceof TypeError || (error instanceof Error && error.name === 'AuthRetryableFetchError')) {
    return 'Unable to reach the account service. Check your connection and try again.';
  }
  return 'We could not complete that request. Please try again.';
}
