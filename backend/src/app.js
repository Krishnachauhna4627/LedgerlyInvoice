import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { adminRouter } from './modules/admin/admin.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { clientsRouter } from './modules/clients/clients.js';
import { companyRouter } from './modules/company/company.js';
import { invoicesRouter } from './modules/invoices/invoices.routes.js';
import { itemsRouter } from './modules/items/items.js';
import { reportsRouter } from './modules/reports/reports.js';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
// Large enough for a signature image upload (see company.js).
app.use(express.json({ limit: '300kb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/company', companyRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/items', itemsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/admin', adminRouter);

app.use('/api', notFound);
app.use(errorHandler);

export default app;
