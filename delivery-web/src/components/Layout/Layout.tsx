import { PropsWithChildren } from 'react';
import './layout.css';

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div className="layout">
      <header className="layout__header">
        <h1>Painel Delivery</h1>
      </header>
      <main className="layout__main">{children}</main>
    </div>
  );
}
