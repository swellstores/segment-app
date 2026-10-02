Send your store events to Segment, and from there to the destinations you connect in Segment. Each event you select arrives in Segment as a track call with a readable name, like Order Paid, and the full record as its properties.

Connect your Segment source with its write key, pick your workspace region and choose the events to send. From then on, each selected event is sent to Segment when it happens in your store.

- **Choose your events.** Pick events by model: accounts, carts, categories, coupons, invoices, orders, pages, payments, products, promotions, shipments and subscriptions. Events you don't check are never sent.
- **Readable names, full records.** Event types become names like Order Paid, Cart Abandoned or Product Review Created, and the order, cart, customer or other record is sent as the event's properties.
- **Retries aren't counted twice.** Each event's Swell ID is sent as its Segment message ID, so Segment ignores a repeat delivery if Swell retries an event.
- **US or EU workspaces.** Choose the region that matches your Segment workspace.
- **Pause any time.** Turn off Enabled to stop sending without losing your write key or event selection.

**Replaces the built-in integration.** The app sends the same event names and data as Swell's built-in Segment integration, including your store ID as the Segment user ID, so your Segment setup keeps working when you switch. If the built-in integration is on when you install the app, Swell offers to turn it off so events aren't sent twice.

Setup takes a few minutes. In Segment, copy the write key from your source's Settings → API Keys. Paste it in the app settings, pick your region and check the events to send, since none are selected at first. Then trigger one of the events you checked, for example by creating a test customer, and watch it arrive in your source's Debugger.
