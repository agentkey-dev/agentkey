export function getSignInErrorMessage(error?: string) {
  switch (error) {
    case undefined:
    case "":
      return null;
    case "expired":
      return "That sign-in link is invalid, expired, or already used. Request a new one.";
    case "invalid-origin":
      return "We couldn't confirm this sign-in request. Reopen the link from your email and try again.";
    case "verification":
      return "This sign-in link did not pass verification. Complete the verification below and request a new link.";
    case "missing-token":
      return "This sign-in link is incomplete. Open the full link from your email or request a new one.";
    default:
      return "We couldn't sign you in. Request a new link and try again.";
  }
}
