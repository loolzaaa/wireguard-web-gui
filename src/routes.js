import controller from './controller.js';

export default function(app) {
    app.get('/addresses', (req, res) => res.send(controller.getNextIpAddresses()));
    app.get('/clients', (req, res) => res.send(controller.listClients()));
    app.post('/clients', (req, res) => res.send(controller.addClient(req.body)));
    app.delete('/clients/:name', (req, res) => res.send(controller.deleteClient(req.params.name)));
}