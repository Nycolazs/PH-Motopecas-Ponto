import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AdminDownloadsPage } from './downloads-page.js';

describe('AdminDownloadsPage', () => {
  it('renders all operating system sections (Windows, Linux, Mac)', () => {
    render(<AdminDownloadsPage />);

    expect(screen.getByText(/Download do Aplicativo Desktop/i)).toBeInTheDocument();
    expect(screen.getByText(/Microsoft Windows/i)).toBeInTheDocument();
    expect(screen.getByText(/Linux \(Debian \/ Ubuntu\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Apple macOS/i)).toBeInTheDocument();
  });

  it('renders download links for Windows .exe, Linux .deb and .AppImage, macOS .dmg', () => {
    render(<AdminDownloadsPage />);

    const windowsBtn = screen.getByRole('link', { name: /Baixar Instalador Windows/i });
    expect(windowsBtn.getAttribute('href')).toMatch(/PH-Ponto-Setup-\d+\.\d+\.\d+\.exe/);

    const debBtn = screen.getByRole('link', { name: /Baixar Pacote Debian/i });
    expect(debBtn.getAttribute('href')).toMatch(/PH-Ponto-\d+\.\d+\.\d+-amd64\.deb/);

    const appImageBtn = screen.getByRole('link', { name: /Baixar AppImage/i });
    expect(appImageBtn.getAttribute('href')).toMatch(/PH-Ponto-\d+\.\d+\.\d+-x86_64\.AppImage/);

    const macBtn = screen.getByRole('link', { name: /Baixar para Apple Silicon/i });
    expect(macBtn.getAttribute('href')).toMatch(/PH-Ponto-\d+\.\d+\.\d+-arm64\.dmg/);
  });

  it('allows copying the linux installation command to clipboard', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    render(<AdminDownloadsPage />);

    const copyBtn = screen.getByRole('button', { name: /Copiar/i });
    await user.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringMatching(/sudo dpkg -i PH-Ponto-\d+\.\d+\.\d+-amd64\.deb/),
    );
    expect(screen.getByText(/Copiado!/i)).toBeInTheDocument();
  });
});
