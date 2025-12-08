import { COURIER_STATUS_LABELS, ORDER_STATUS_LABELS, ROUTE_STATUS_LABELS } from '../../utils/statusLabels';
import { CourierStatus, OrderStatus, RouteStatus } from '../../types';
import './status-guide.css';

interface StatusItem {
  code: string;
  label: string;
  description: string;
}

interface StatusGroup {
  title: string;
  subtitle: string;
  items: StatusItem[];
}

const orderDescriptions: Record<OrderStatus, string> = {
  PENDING: 'Pedido recém cadastrado aguardando agrupamento. Ainda pode ser editado ou removido.',
  QUEUED: 'Pedido já foi agrupado em uma rota, mas nenhum motoboy iniciou a execução.',
  ON_ROUTE: 'Motoboy saiu para a entrega. O endereço não deve mais ser alterado.',
  DELIVERED: 'Pedido finalizado. Os valores entram nas métricas e relatórios.',
};

const routeDescriptions: Record<RouteStatus, string> = {
  AWAITING_COURIER: 'Rota criada automaticamente, mas sem motoboy definido.',
  ASSIGNED: 'Um motoboy já foi escolhido. Aguardando ele iniciar pelo app.',
  IN_PROGRESS: 'Motoboy iniciou a rota pelo app e está executando as entregas.',
  DONE: 'Todos os pedidos foram entregues e o motoboy está livre novamente.',
};

const courierDescriptions: Record<CourierStatus, string> = {
  OFFLINE: 'Não está disponível para receber rotas. Precisa fazer login e ativar disponibilidade.',
  AVAILABLE: 'Pode receber novas rotas. Aparece na lista de atribuição manual/automática.',
  ASSIGNED: 'Já existe uma rota atribuída, aguardando o motoboy iniciar pelo app.',
  ON_TRIP: 'Executando uma rota em andamento.',
};

const groups: StatusGroup[] = [
  {
    title: 'Pedidos',
    subtitle: 'Mostram em que etapa do fluxo cada pedido se encontra.',
    items: (Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((status) => ({
      code: status,
      label: ORDER_STATUS_LABELS[status],
      description: orderDescriptions[status],
    })),
  },
  {
    title: 'Rotas',
    subtitle: 'Indicam o status do agrupamento de pedidos.',
    items: (Object.keys(ROUTE_STATUS_LABELS) as RouteStatus[]).map((status) => ({
      code: status,
      label: ROUTE_STATUS_LABELS[status],
      description: routeDescriptions[status],
    })),
  },
  {
    title: 'Motoboys',
    subtitle: 'Mostram a disponibilidade operacional de cada profissional.',
    items: (Object.keys(COURIER_STATUS_LABELS) as CourierStatus[]).map((status) => ({
      code: status,
      label: COURIER_STATUS_LABELS[status],
      description: courierDescriptions[status],
    })),
  },
  {
    title: 'Dia de operação',
    subtitle: 'Define quais dados aparecem em tempo real no painel.',
    items: [
      {
        code: 'Iniciar dia',
        label: 'Abertura',
        description: 'Limpa o painel histórico e passa a mostrar apenas pedidos criados após a abertura.',
      },
      {
        code: 'Fechar dia',
        label: 'Encerramento',
        description: 'Arquiva os pedidos/rotas daquele período e reinicia os totais para o próximo turno.',
      },
      {
        code: 'Exibir histórico completo',
        label: 'Histórico',
        description: 'Mostra todos os pedidos, independentemente do dia de operação. Útil para auditorias.',
      },
    ],
  },
];

export default function StatusGuide() {
  return (
    <section className="panel status-guide">
      <header className="panel__header">
        <div>
          <h2>Guia de Status e Labels</h2>
          <p className="panel__subtitle">
            Consulte o significado de cada status usado no painel para orientar a equipe durante o dia.
          </p>
        </div>
      </header>

      <div className="status-guide__grid">
        {groups.map((group) => (
          <article key={group.title} className="status-guide__card">
            <h3>{group.title}</h3>
            <p className="status-guide__subtitle">{group.subtitle}</p>
            <dl>
              {group.items.map((item) => (
                <div key={item.code} className="status-guide__item">
                  <dt>
                    <span className="status-guide__label">{item.label}</span>
                    <span className="status-guide__code">Código: {item.code}</span>
                  </dt>
                  <dd>{item.description}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
