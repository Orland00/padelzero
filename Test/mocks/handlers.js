import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('https://ipapi.co/json/', () => {
    return HttpResponse.json({
      city: 'Cancún',
      country_name: 'México',
    });
  }),

  // Auth handlers
  http.get('*/auth/v1/user', () => {
    return HttpResponse.json(null, { status: 401 });
  }),
  
  // Profile handlers
  http.get('*/rest/v1/profiles*', ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (id?.includes('eq.')) {
      return HttpResponse.json([]);
    }
    return HttpResponse.json([]);
  }),

  // Add more as needed during execution
];
