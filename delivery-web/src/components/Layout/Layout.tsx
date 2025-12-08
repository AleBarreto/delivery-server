import { PropsWithChildren } from 'react';
import './layout.css';

interface LayoutProps extends PropsWithChildren {
  adminName?: string;
  onLogout?: () => void;
}

export default function Layout({ children, adminName, onLogout }: LayoutProps) {
  return (
    <div className="layout">
      <header className="layout__header">
        <h1>Painel Delivery</h1>
        {adminName && (
          <div className="layout__user">
            <div className="layout__user-info">
              <span>Logado como</span>
              <strong>{adminName}</strong>
            </div>
            {onLogout && (
              <button className="layout__logout" type="button" onClick={onLogout}>
                Sair
              </button>
            )}
          </div>
        )}
      </header>
      <main className="layout__main">{children}</main>
    </div>
  );
}
