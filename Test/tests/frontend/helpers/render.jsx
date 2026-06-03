import React from 'react';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from '@/lib/i18n';

export const renderWithProviders = (ui, { route = '/' } = {}) => {
  window.history.pushState({}, 'Test page', route);

  return render(ui, {
    wrapper: ({ children }) => (
      <I18nProvider>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </I18nProvider>
    ),
  });
};
