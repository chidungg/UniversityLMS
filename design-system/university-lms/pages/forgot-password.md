# Forgot password dialog

Scope: English-only desktop frontend. The user's new visual reference defines an administrator recovery request with required account email, optional note (500 characters), identity-verification guidance, close, Cancel and Send request. This is a frontend demonstration of that workflow, not confirmation of an existing backend or final authorization policy.

Use the existing University LMS brand, font and primary color. Center a 520px white dialog with 12px corners, separated header, 24px content padding, subdued blue information panel, and a dark blurred backdrop. The reference supplies the layout; the existing design tokens supply the styling.

Use native `dialog.showModal()` to make the underlying page inert and constrain keyboard focus. Initially focus email; reuse the email already entered on login. Escape, close and Cancel dismiss the dialog, abort the pending preview and restore focus to the trigger. Keep login values intact. Do not dismiss from backdrop clicks, which could accidentally discard a note. Allow the dialog itself to scroll on short desktop windows.

Validate on blur and submit; associate inline messages with inputs and focus the first invalid field. Show a counter and enforce the 500-character note limit. Disable repeat submissions during loading. Preserve input on failure and allow retry. Focus the confirmation when the preview completes.

Always identify the flow as a preview. The success screen states explicitly that no request was sent and no password changed. No credentials, drafts or account identifiers are persisted. No OTP, reset token or password field is introduced because verification remains unspecified in the original Markdown.
