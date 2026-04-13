import { render, screen } from '@testing-library/react';
import App from './App';

test('renders home hero and registration CTA', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /join clutch gym now/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /start registration/i })).toHaveAttribute('href', '/register');
});
