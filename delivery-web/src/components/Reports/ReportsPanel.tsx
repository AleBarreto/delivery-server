import { FormEvent, useMemo, useState } from 'react';
import { useOrdersReport } from '../../hooks/useReports';
import { Order } from '../../types';
import './reports.css';

function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

const statusLabels: Record<Order['status'], string> = {
  PENDING: 'Pendentes',
  QUEUED: 'Na fila/rota',
  ON_ROUTE: 'Em rota',
  DELIVERED: 'Entregues',
};

const STATUS_ORDER: Order['status'][] = ['PENDING', 'QUEUED', 'ON_ROUTE', 'DELIVERED'];

const moneyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const percentFormatter = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

function sanitizeForFilename(value: string) {
  return value.replace(/[:T]/g, '-');
}

function escapeCsv(value: string | number | null | undefined) {
  if (value === undefined || value === null) {
    return '';
  }
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export default function ReportsPanel() {
  const { from: defaultFrom, to: defaultTo } = defaultRange();
  const { report, loading, error, fetchReport, from: lastFrom, to: lastTo } = useOrdersReport(defaultFrom, defaultTo);
  const [from, setFrom] = useState(defaultFrom.toISOString().slice(0, 16));
  const [to, setTo] = useState(defaultTo.toISOString().slice(0, 16));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    fetchReport(new Date(from), new Date(to));
  };

  const maxStatusValue = useMemo(() => {
    if (!report) return 0;
    return STATUS_ORDER.reduce((max, status) => Math.max(max, report.totals.byStatus[status] ?? 0), 0);
  }, [report]);

  const trendChart = useMemo(() => {
    if (!report || report.byDay.length === 0) {
      return { width: 320, height: 80, points: '' };
    }
    const width = Math.max(320, (report.byDay.length - 1) * 80);
    const height = 80;
    const max = Math.max(...report.byDay.map((day) => day.count), 1);
    const points = report.byDay
      .map((day, index) => {
        const x = report.byDay.length === 1 ? width / 2 : (index / (report.byDay.length - 1)) * width;
        const y = height - (day.count / max) * height;
        return `${x},${y}`;
      })
      .join(' ');
    return { width, height, points };
  }, [report]);

  const handleExportCsv = () => {
    if (!report) return;
    const rows = [
      ['Pedido', 'Endereço', 'Status', 'Motoboy', 'Valor (R$)', 'Criado em'],
      ...report.orders.map((order) => [
        order.id,
        order.address,
        statusLabels[order.status],
        order.courierName ?? '',
        order.deliveryPrice != null ? order.deliveryPrice.toFixed(2) : '',
        new Date(order.createdAt).toLocaleString(),
      ]),
    ];
    const csv = rows.map((cols) => cols.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const filename = `relatorio-${sanitizeForFilename(from)}-a-${sanitizeForFilename(to)}.csv`;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="panel reports-panel">
      <header className="panel__header">
        <div>
          <h2>Relatórios de pedidos</h2>
          <p className="panel__subtitle">Selecione o período, gere insights visuais e exporte os dados.</p>
        </div>
        {report && report.orders.length > 0 && (
          <button className="button" type="button" onClick={handleExportCsv}>
            Exportar CSV
          </button>
        )}
      </header>

      <form className="reports-filter" onSubmit={handleSubmit}>
        <label>
          Início
          <input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} required />
        </label>
        <label>
          Fim
          <input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} required />
        </label>
        <button className="button button--primary" type="submit" disabled={loading}>
          {loading ? 'Gerando...' : 'Gerar'}
        </button>
      </form>

      {error && <p className="settings-error">{error}</p>}

      {report && (
        <>
          <div className="reports-summary">
            <div>
              <p className="reports-summary__label">Pedidos no período</p>
              <p className="reports-summary__value">{report.totals.count}</p>
            </div>
            <div>
              <p className="reports-summary__label">Valor previsto</p>
              <p className="reports-summary__value">{formatMoney(report.totals.totalValue)}</p>
            </div>
            <div>
              <p className="reports-summary__label">Ticket médio</p>
              <p className="reports-summary__value">{formatMoney(report.totals.averageValue)}</p>
            </div>
            <div>
              <p className="reports-summary__label">Entrega concluída</p>
              <p className="reports-summary__value">
                {percentFormatter.format(report.totals.deliveredRate || 0)} ({report.totals.deliveredCount} pedidos)
              </p>
            </div>
          </div>

          <div className="reports-analytics">
            <div className="reports-card">
              <h3>Distribuição por status</h3>
              {STATUS_ORDER.map((status) => {
                const count = report.totals.byStatus[status] ?? 0;
                const percent = maxStatusValue > 0 ? Math.round((count / maxStatusValue) * 100) : 0;
                return (
                  <div key={status} className="reports-status-row">
                    <span>{statusLabels[status]}</span>
                    <strong>{count}</strong>
                    <div className="reports-status-bar">
                      <span style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="reports-card">
              <h3>Volume diário</h3>
              {report.byDay.length === 0 ? (
                <p className="reports-empty">Sem pedidos neste período.</p>
              ) : (
                <>
                  <svg width={trendChart.width} height={trendChart.height} className="reports-trend-chart">
                    <polyline points={trendChart.points} fill="none" stroke="#4f46e5" strokeWidth={3} />
                  </svg>
                  <div className="reports-trend-labels">
                    {report.byDay.map((day) => (
                      <span key={day.date}>
                        {new Date(day.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · {day.count} pedidos
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="reports-card">
              <h3>Motoboys com mais pedidos</h3>
              {report.courierStats.length === 0 ? (
                <p className="reports-empty">Nenhuma rota finalizada neste período.</p>
              ) : (
                <ol className="reports-ranking">
                  {report.courierStats.slice(0, 5).map((courier) => (
                    <li key={courier.courierId}>
                      <span>{courier.courierName ?? courier.courierId.slice(0, 6)}</span>
                      <strong>{courier.count} pedidos</strong>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <div className="reports-period-label">
            <span>
              Intervalo atual: {lastFrom.toLocaleString()} — {lastTo.toLocaleString()}
            </span>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Motoboy</th>
                  <th>Status</th>
                  <th>Valor</th>
                  <th>Quando</th>
                </tr>
              </thead>
              <tbody>
                {report.orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <p className="table-title">{order.address}</p>
                      <p className="table-subtitle">#{order.id.slice(0, 6)}</p>
                    </td>
                    <td>{order.courierName ?? '---'}</td>
                    <td>{statusLabels[order.status]}</td>
                    <td>{order.deliveryPrice != null ? formatMoney(order.deliveryPrice) : '-'}</td>
                    <td>{new Date(order.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
