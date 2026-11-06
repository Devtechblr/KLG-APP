// End-to-end flows: the real app (live mode) driven through its screens,
// against the simulated KLG backend in fakeBackend.js.
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App';
import { DataProvider } from '../src/context/DataContext';
import { SessionProvider } from '../src/context/SessionContext';
import { installFakeBackend, makeOrder } from './fakeBackend';

function renderApp(path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider><DataProvider><App /></DataProvider></SessionProvider>
    </MemoryRouter>
  );
}

async function signIn(identifier, password) {
  fireEvent.change(await screen.findByLabelText('Email or mobile number'), { target: { value: identifier } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

const click = (name) => fireEvent.click(screen.getByRole('button', { name }));
const swipe = async (label) => fireEvent.keyDown(await screen.findByRole('button', { name: label }), { key: 'Enter' });
const confirmDialog = async (confirmLabel) => {
  const dlg = (await screen.findAllByRole('alertdialog')).at(-1); // topmost
  fireEvent.click(within(dlg).getByRole('button', { name: confirmLabel }));
};

describe('sign-in', () => {
  it('shows a clear error for a wrong password', async () => {
    installFakeBackend();
    renderApp();
    await signIn('desk@klg.test', 'nope');
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email/phone or password.');
  });

  it('refuses admin roles that cannot use the delivery app', async () => {
    installFakeBackend();
    renderApp();
    await signIn('kitchen@klg.test', 'kitchen-pass');
    expect(await screen.findByRole('alert')).toHaveTextContent(/"Self" role can't use the delivery app/);
  });

  it('sends an expired session back to sign-in', async () => {
    const be = installFakeBackend();
    be.state.orders.push(makeOrder({ n: 1 }));
    renderApp();
    await signIn('desk@klg.test', 'desk-pass');
    await screen.findAllByText('KLG-T1');
    be.state.tokens.clear(); // server revokes the token
    click('Accept Order');
    expect(await screen.findByRole('alert')).toHaveTextContent('Your session expired');
    expect(localStorage.getItem('klg.session')).toBeNull();
  });
});

describe('full delivery: accept -> prepare -> parcel -> driver picks up -> delivered', () => {
  it('runs the whole lifecycle against the backend rules', async () => {
    const be = installFakeBackend();
    be.state.orders.push(makeOrder({ n: 1001 }));
    const order = () => be.state.orders[0];
    const asAdmin = async () => { localStorage.clear(); const v = renderApp(); await signIn('desk@klg.test', 'desk-pass'); await screen.findAllByText('KLG-T1001'); return v; };
    const asDriver = async () => { localStorage.clear(); const v = renderApp(); await signIn('9000000001', 'ravi-pass'); await screen.findAllByText('Order #T1001'); return v; };

    // 1. Delivery staff accept the new order -> Preparing. No driver is contacted yet.
    let view = await asAdmin();
    expect(screen.getByText(/auto-accepts in/)).toBeInTheDocument();
    click('Accept Order');
    await waitFor(() => expect(order().orderStatus).toBe('PREPARING'));
    expect(screen.queryByRole('button', { name: 'Assign Driver' })).toBeNull();
    expect(order().assignmentMode).not.toBe('AUTO');

    // 2. Parcel ready -> the main button becomes Assign Driver (offline drivers can't be picked)
    click('Parcel Ready');
    await waitFor(() => expect(order().orderStatus).toBe('PACKING'));
    fireEvent.click(await screen.findByRole('button', { name: 'Assign Driver' }));
    expect(await screen.findByRole('dialog', { name: 'Assign Driver' })).toBeInTheDocument();
    expect(screen.getByText('All online drivers').closest('[role="radio"]')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Sita Driver').closest('[role="radio"]')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByText('Ravi Driver').closest('[role="radio"]'));
    click('Assign to Ravi Driver');
    await waitFor(() => expect(order()).toMatchObject({ riderId: 'r1', riderAcceptedAt: null }));
    expect(await screen.findByText('Waiting for driver to accept')).toBeInTheDocument();
    view.unmount();

    // 3. Driver gets the ringing "incoming delivery" screen and accepts
    view = await asDriver();
    const incoming = await screen.findByRole('alertdialog', { name: 'Order #T1001' });
    expect(within(incoming).getByText('Delivery assigned to you')).toBeInTheDocument();
    fireEvent.click(within(incoming).getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(order().riderAcceptedAt).not.toBeNull());
    await waitFor(() => expect(screen.queryByRole('alertdialog', { name: 'Order #T1001' })).toBeNull());

    // 4. Driver picks up and delivers (COD -> confirm cash)
    await swipe('Swipe when picked up');
    await waitFor(() => expect(order().orderStatus).toBe('OUT_FOR_DELIVERY'));
    await swipe('Swipe to mark delivered');
    await confirmDialog('Cash received');
    await waitFor(() => expect(order().orderStatus).toBe('DELIVERED'));
    expect(be.state.riders[0].status).toBe('AVAILABLE');
    expect(order().statusHistory.map((h) => h.status)).toEqual(['PENDING', 'PREPARING', 'PACKING', 'ACCEPTED', 'OUT_FOR_DELIVERY', 'DELIVERED']);
    fireEvent.click(screen.getByRole('link', { name: /History/ }));
    expect(await screen.findByText('Order #T1001')).toBeInTheDocument();
  });

  it('admin can mark an out-for-delivery order delivered (backup)', async () => {
    const be = installFakeBackend();
    be.state.orders.push(makeOrder({ n: 1002, orderStatus: 'OUT_FOR_DELIVERY', riderId: 'r1', riderName: 'Ravi Driver', riderAcceptedAt: 'x' }));
    renderApp();
    await signIn('desk@klg.test', 'desk-pass');
    expect(await screen.findByText('Picked up · on the way')).toBeInTheDocument();
    click('Mark Delivered');
    await confirmDialog('Mark Delivered');
    await waitFor(() => expect(be.state.orders[0].orderStatus).toBe('DELIVERED'));
  });

  it('a ready parcel without a driver opens Assign Driver', async () => {
    const be = installFakeBackend();
    be.state.orders.push(makeOrder({ n: 1003, orderStatus: 'PACKING' }));
    renderApp();
    await signIn('desk@klg.test', 'desk-pass');
    fireEvent.click(await screen.findByRole('button', { name: 'Assign Driver' }));
    expect(await screen.findByRole('dialog', { name: 'Assign Driver' })).toBeInTheDocument();
    expect(screen.getByText('Order', { exact: false, selector: '.sheet-sub' })).toHaveTextContent('KLG-T1003');
  });
});

describe('auto offers', () => {
  it('admin offers to all online drivers; a driver can decline', async () => {
    const be = installFakeBackend();
    be.state.orders.push(makeOrder({ n: 2002, orderStatus: 'PACKING' }));
    const view = renderApp();
    await signIn('desk@klg.test', 'desk-pass');
    fireEvent.click(await screen.findByRole('button', { name: 'Assign Driver' }));
    click('Send to all online drivers (1)');
    await waitFor(() => expect(be.state.orders[0]).toMatchObject({ assignmentMode: 'AUTO', offeredRiderIds: ['r1'] }));
    expect(await screen.findByText(/offered to 1 online driver/)).toBeInTheDocument();

    view.unmount();
    localStorage.clear();
    renderApp();
    await signIn('ravi@klg.test', 'ravi-pass');
    const incoming = await screen.findByRole('alertdialog', { name: 'Order #T2002' });
    expect(within(incoming).getByText('New delivery request')).toBeInTheDocument();
    fireEvent.click(within(incoming).getByRole('button', { name: 'Decline' }));
    await confirmDialog('Decline');
    await waitFor(() => expect(be.state.orders[0].rejectedRiderIds).toEqual(['r1']));
    expect(await screen.findByText('Waiting for orders')).toBeInTheDocument();
  });
});

describe('driver rules from the backend are shown to the driver', () => {
  it('cannot accept while offline, then can after going online', async () => {
    const be = installFakeBackend();
    be.state.riders[1].status = 'OFFLINE';
    be.state.orders.push(makeOrder({ n: 3003, orderStatus: 'READY', riderId: 'r2', riderName: 'Sita Driver' }));
    renderApp();
    await signIn('9000000002', 'sita-pass');
    await swipe('Swipe to accept delivery');
    expect(await screen.findByText('You must be ONLINE and AVAILABLE to accept deliveries.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Online toggle
    await waitFor(() => expect(be.state.riders[1].status).toBe('AVAILABLE'));
    await swipe('Swipe to accept delivery');
    await waitFor(() => expect(be.state.orders[0].riderAcceptedAt).not.toBeNull());
  });
});

describe('drivers management', () => {
  it('admin adds a driver who can then sign in', async () => {
    const be = installFakeBackend();
    const view = renderApp();
    await signIn('desk@klg.test', 'desk-pass');
    await waitFor(() => expect(localStorage.getItem('klg.session')).not.toBeNull());
    view.unmount();
    renderApp('/admin/drivers'); // session persists across app restarts
    expect(await screen.findByText('Ravi Driver')).toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole('button', { name: /Add/ }))[0]);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ramesh Kumar'), { target: { value: 'Kiran New' } });
    fireEvent.change(screen.getByPlaceholderText('10-digit number'), { target: { value: '9000000009' } });
    fireEvent.change(screen.getByPlaceholderText('At least 6 characters'), { target: { value: 'kiran-pass' } });
    fireEvent.change(screen.getByPlaceholderText('KA-05-AB-1234'), { target: { value: 'ka03ef9999' } });
    click('Add driver');
    await waitFor(() => expect(be.state.riders.at(-1)).toMatchObject({ name: 'Kiran New', phone: '9000000009', password: 'kiran-pass', vehicleNumber: 'KA03EF9999' }));
  });
});

describe('new order popup and auto-accept', () => {
  it('pops up with Accept and Reject; Accept moves the order to Preparing', async () => {
    const be = installFakeBackend();
    be.state.orders.push(makeOrder({ n: 2001 }));
    renderApp();
    await signIn('desk@klg.test', 'desk-pass');
    const dlg = await screen.findByRole('dialog', { name: 'New delivery order' });
    expect(within(dlg).getByText(/Auto-accepts/)).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(be.state.orders[0].orderStatus).toBe('PREPARING'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New delivery order' })).toBeNull());
    // Drivers are only contacted later, from Assign Driver once the parcel is ready.
    expect(be.state.orders[0].assignmentMode).not.toBe('AUTO');
  });

  it('Reject cancels the order after confirming', async () => {
    const be = installFakeBackend();
    be.state.orders.push(makeOrder({ n: 2002 }));
    renderApp();
    await signIn('desk@klg.test', 'desk-pass');
    const dlg = await screen.findByRole('dialog', { name: 'New delivery order' });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Reject' }));
    await confirmDialog('Reject Order');
    await waitFor(() => expect(be.state.orders[0].orderStatus).toBe('CANCELLED'));
  });

  it('accepts by itself once the order has waited 60 seconds', async () => {
    const be = installFakeBackend();
    const at = new Date(Date.now() - 61_000).toISOString();
    be.state.orders.push(makeOrder({ n: 2003, createdAt: at, pendingAt: at }));
    renderApp();
    await signIn('desk@klg.test', 'desk-pass');
    await waitFor(() => expect(be.state.orders[0].orderStatus).toBe('PREPARING'), { timeout: 4000 });
  });
});

describe('driver home', () => {
  it('bell lists what the driver must do next; job card shows the 3 steps', async () => {
    const be = installFakeBackend();
    be.state.orders.push(makeOrder({ n: 4004, orderStatus: 'PACKING', riderId: 'r1', riderName: 'Ravi Driver', riderAcceptedAt: 'x' }));
    renderApp();
    await signIn('9000000001', 'ravi-pass');
    expect(await screen.findByText("You're Online")).toBeInTheDocument();
    expect(screen.getByText('Parcel is ready · go to the counter and pick it up')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Step 2 of 3' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Notifications (1)' }));
    const sheet = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(within(sheet).getByText('Parcel ready · pick up now')).toBeInTheDocument();
  });
});
