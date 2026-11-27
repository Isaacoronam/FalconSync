import { expect, test } from '@playwright/test';

test('Chivito carga con su estado, sus preguntas de inicio y sin selector de lugar', async ({
  page,
}) => {
  await page.goto('/guia');

  await expect(page).toHaveTitle('Chivito, tu guía | FALCONSYNC');
  await expect(page.locator('#guide-title')).toContainText('Conoce Coro con Chivito');
  await expect(page.locator('.chat__avatar')).toBeVisible();
  await expect(page.locator('.chat__top')).toContainText('Guía turístico de FalconSync');

  // El spec funciona en los dos modos: sin corpus (Chivito en preparación)
  // y con corpus RAG (Chivito disponible, entrada y preguntas habilitadas).
  const status = page.locator('.chat__availability');
  await expect(status).toBeVisible();
  await expect(status).toHaveText(/Chivito (disponible|en preparación)/);

  const statusText = ((await status.textContent()) ?? '').trim();
  const available = statusText.startsWith('Chivito disponible');
  const question = page.locator('#chat-question');
  const send = page.getByRole('button', { name: 'Enviar pregunta' });
  const prompt = page.getByRole('button', { name: '¿Qué es Coro?' });

  await expect(prompt).toBeVisible();

  if (available) {
    await expect(question).toBeEnabled();
    await expect(prompt).toBeEnabled();
    // El botón de envío se habilita cuando hay texto en el compositor.
    await question.fill('¿Qué es Coro?');
    await expect(send).toBeEnabled();
    await question.fill('');
  } else {
    await expect(question).toBeDisabled();
    await expect(send).toBeDisabled();
    await expect(prompt).toBeDisabled();
  }

  // Sin selector de lugar: el lugar se resuelve desde el texto de la pregunta.
  await expect(page.locator('select')).toHaveCount(0);

  // El apoyo técnico no se ofrece a visitantes anónimos.
  await expect(page.getByRole('button', { name: /Apoyo técnico/ })).toHaveCount(0);

  // La guía ofrece continuar en Telegram con el icono de la marca.
  const telegram = page.locator('.chat-telegram__action');
  await expect(telegram).toBeVisible();
  await expect(telegram).toHaveAttribute('href', 'https://t.me/Falconsync_bot');
  await expect(telegram).toHaveAttribute('target', '_blank');
  await expect(telegram).toHaveAccessibleName('Abrir @Falconsync_bot en Telegram');
  await expect(telegram.locator('.chat-telegram__icon svg')).toBeVisible();
});
