import { useData, useUi } from '../../context/DataContext';
import { NEXT_STEP, STATUS, orderDriver } from '../../utils/status';
import { printOrder } from '../../services/native/printer';

export default function useOrderActions() {
  const { actions, customerById, driverById } = useData();
  const { confirm, toast } = useUi();

  return {
    advance: async (order) => {
      const step = NEXT_STEP[order.status];
      if (!step) return;
      if (step.to === 'OUT_FOR_DELIVERY' && 'riderAccepted' in order && !order.riderAccepted) {
        const ok = await confirm({ title: 'Driver has not accepted yet', message: `Mark ${order.id} as picked up by ${order.riderName || 'the driver'} anyway?`, confirmLabel: 'Handed over' });
        if (!ok) return;
        return actions.setStatus(order.id, step.to);
      }
      if (step.to === 'DELIVERED') {
        const ok = await confirm({ title: 'Mark as delivered?', message: `${order.id} will be closed as delivered.`, confirmLabel: 'Mark Delivered' });
        if (!ok) return;
      }
      actions.setStatus(order.id, step.to);
    },
    setStatus: async (order, status) => {
      if (status === order.status) return;
      const ok = await confirm({ title: `Change status to ${STATUS[status].label}?`, message: order.id, confirmLabel: 'Update' });
      if (ok) actions.setStatus(order.id, status, 'Updated manually');
    },
    cancel: async (order) => {
      const ok = await confirm({
        title: 'Cancel this order?',
        message: `${order.id} will be cancelled.${order.paymentStatus === 'PAID' ? ' The online payment will be marked as refunded.' : ''}`,
        confirmLabel: 'Cancel Order',
        cancelLabel: 'Keep Order',
        danger: true,
      });
      if (ok) actions.setStatus(order.id, 'CANCELLED', 'Cancelled by restaurant');
    },
    print: async (order) => {
      try {
        const how = await printOrder(order, customerById[order.customerId], orderDriver(order, driverById));
        toast(how === 'bluetooth' ? `Receipt printed · ${order.id}` : 'Opening print dialog', how === 'bluetooth' ? 'success' : 'info');
      } catch (e) {
        toast(`Print failed: ${e.message || e}`, 'danger');
      }
    },
  };
}
