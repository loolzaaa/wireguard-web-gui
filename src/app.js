import express from 'express';
import routes from './routes.js';
import controller from './controller.js';

const app = express();
const port = 8622;

app.use(express.json());
app.use('/', express.static('public')); //FIXME

routes(app);
controller.init();

app.listen(port, () => {
    console.log(`Wireguard Web Gui app listening on port ${port}`)
});
