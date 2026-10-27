export function initContact() {
  document.querySelectorAll('[data-open-chat]').forEach(button => button.addEventListener('click', () => {
    const launcher = document.querySelector('#ftc-chat-button');
    if (launcher?.getAttribute('aria-expanded') !== 'true') launcher?.click();
    document.querySelector('#ftc-chat-input')?.focus();
  }));
}
