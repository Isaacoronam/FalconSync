import { expect, test } from '@playwright/test';

test('Chivito carga con su estado, sus preguntas de inicio y sin selector de lugar', async ({
  page,
}) => {
  await page.goto('/guia');

  await expect(page).toHaveTitle('Chivito, tu guía | FALCONSYNC');
  await expect(page.locator('#guide-title')).toContainText('Conoce Coro con Chivito');
  await expect(page.locator('.chat__avatar')).toBeVisible();
  await expect(page.locator('.chat__top')).toContainText('Guía turístico de FalconSync');

  // El entorno E2E corre sin corpus RAG (RAG_TOURIST_ENABLED apagado): Chivito se
  // declara en preparación y bloquea la consulta. Si se habilita el corpus en E2E,
  // este estado pasa a "Chivito disponible" y el spec debe actualizarse.
  const status = page.locator('.chat__availability');
  await expect(status).toBeVisible();
  await expect(status).toHaveText('Chivito en preparación');

  await expect(page.locator('#chat-question')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Enviar pregunta' })).toBeDisabled();

  const prompt = page.getByRole('button', { name: '¿Qué es Coro?' });
  await expect(prompt).toBeVisible();
  await expect(prompt).toBeDisabled();

  // Sin selector de lugar: el lugar se resuelve desde el texto de la pregunta.
  await expect(page.locator('select')).toHaveCount(0);

  // El apoyo técnico no se ofrece a visitantes anónimos.
  await expect(page.getByRole('button', { name: /Apoyo técnico/ })).toHaveCount(0);

  // La guía ofrece continuar en Telegram.
  const telegram = page.locator('.chat-telegram__action');
  await expect(telegram).toBeVisible();
  await expect(telegram).toHaveAttribute('href', 'https://t.me/Falconsync_bot');
  await expect(telegram).toHaveAttribute('target', '_blank');
});
