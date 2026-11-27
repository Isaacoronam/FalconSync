import {
  createLinkCode,
  getLinkStatus,
  unlinkUser,
} from '../../microservices/channelLinkService.js';

export async function createTelegramLinkCodeController(request, response) {
  const result = await createLinkCode(request.user._id);

  response.set('Cache-Control', 'no-store');
  response.status(201).json({ data: result });
}

export async function getTelegramLinkController(request, response) {
  response.set('Cache-Control', 'no-store');
  response.json({ data: await getLinkStatus(request.user._id) });
}

export async function unlinkTelegramController(request, response) {
  response.set('Cache-Control', 'no-store');
  response.json({ data: await unlinkUser(request.user._id) });
}
