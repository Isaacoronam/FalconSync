import {
  getAssistantStatus,
  queryAssistant,
} from '../../microservices/assistantService.js';

export async function getAssistantStatusController(_request, response) {
  response.json({ data: await getAssistantStatus() });
}

export async function queryTouristAssistant(request, response) {
  response.json({
    data: await queryAssistant(request.body, 'tourist'),
  });
}

export async function queryTechnicalAssistant(request, response) {
  response.json({
    data: await queryAssistant(request.body, 'technical', request.user),
  });
}
