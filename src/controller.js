import { readFile } from 'node:fs/promises';
import { opendirSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { execSync } from "child_process";

const execOptions = {
    encoding: 'utf8',
    shell: '/bin/bash'
}

export default {
    serverParams: null,
    serverConfig: null,
    async init() {
        await this.refreshParams();
        await this.refreshConfig();
    },
    getNextIpAddresses() {
        if (!this.serverConfig || !this.serverParams) {
            return { ok: false, msg: 'Server params/config read error' };
        }
        let dotIp;
        let idxV4 = this.serverParams.SERVER_WG_IPV4.lastIndexOf('.');
        let addrV4 = this.serverParams.SERVER_WG_IPV4.substring(0, idxV4);
        let idxV6 = this.serverParams.SERVER_WG_IPV6.lastIndexOf('::');
        let addrV6 = this.serverParams.SERVER_WG_IPV6.substring(0, idxV6);
        for (let i = 2; i <= 254; i++) {
            if (!this.serverConfig.includes(`${addrV4}.${i}`)) {
                dotIp = i;
                break;
            }
        }
        if (!dotIp) {
            return { ok: false, msg: 'The subnet configured supports only 253 clients.' };
        }
        let ipv4 = `${addrV4}.${dotIp}`;
        let ipv6 = `${addrV6}::${dotIp}`;
        return { ok: true, data: { ipv4, ipv6 }};
    },
    listClients() {
        if (!this.serverConfig || !this.serverParams) {
            return { ok: false, msg: 'Server params/config read error' };
        }
        let preClients = this.serverConfig.split('\n').filter(s => s.startsWith('### Client '));
        if (preClients.length === 0) {
            return { ok: true, data: [] };
        } else {
            let clients = [];
            preClients.forEach(el => clients.push(el.replace('### Client ', '')))
            return { ok: true, data: clients };
        }
    },
    addClient(clientParams) {
        if (!this.serverConfig || !this.serverParams) {
            return { ok: false, msg: 'Server params/config read error' };
        }

        // If SERVER_PUB_IP is IPv6, add brackets if missing
        if (!this.serverParams.SERVER_PUB_IP.match(/^\[.*:.*\]$/)) {
            this.serverParams.SERVER_PUB_IP = `[${this.serverParams.SERVER_PUB_IP}]`;
        }

        const endpoint = `${this.serverParams.SERVER_PUB_IP}:${this.serverParams.SERVER_PORT}`;
        const clientName = clientParams.name;
        const clientWgIpV4 = clientParams.ipv4;
        const clientWgIpV6 = clientParams.ipv6;

        let existingClients = this.listClients();
        if (!clientName || clientName.length < 2) {
            return { ok: false, msg: 'A client name length must be at least 2' };
        }
        if (existingClients.data.includes(clientName)) {
            return { ok: false, msg: 'A client with the specified name was already created' };
        }

        if (!clientWgIpV4 || !clientWgIpV4.match(/^(\d{1,3}\.){3}(\d{1,3}){1}$/)) {
            return { ok: false, msg: 'A client with the specified IPv4 was already created' };
        }
        if (this.serverConfig.includes(`${clientWgIpV4}/32`)) {
            return { ok: false, msg: 'A client with the specified IPv4 was already created' };
        }

        if (!clientWgIpV6 || !clientWgIpV6.match(/^([0-9a-fA-F]{1,4}:){3}:([0-9a-fA-F]{1,4}){1}$/)) {
            return { ok: false, msg: 'A client with the specified IPv6 was already created' };
        }
        if (this.serverConfig.includes(`${clientWgIpV6}/128`)) {
            return { ok: false, msg: 'A client with the specified IPv6 was already created' };
        }

        // Generate key pair for the client
        let clientPrivateKey;
        let clientPublicKey;
        let clientPreSharedKey;
        try {
            clientPrivateKey = execSync('wg genkey', execOptions).trim();
            clientPublicKey = execSync(`echo "${clientPrivateKey}" | wg pubkey`, execOptions).trim();
            clientPreSharedKey = execSync('wg genpsk', execOptions).trim();
        } catch (err) {
            return { ok: false, msg: 'Key generation error', data: err };
        }

        const homeDir = getHomeDirForClient(clientName);

        // Create client file and add the server as a peer
        const clientConfig = `[Interface]\n` + 
        `PrivateKey = ${clientPrivateKey}\n` +
        `Address = ${clientWgIpV4}/32,${clientWgIpV6}/128\n` +
        `DNS = ${this.serverParams.CLIENT_DNS_1},${this.serverParams.CLIENT_DNS_2}\n` +
        `\n` +
        `[Peer]\n` +
        `PublicKey = ${this.serverParams.SERVER_PUB_KEY}\n` +
        `PresharedKey = ${clientPreSharedKey}\n` +
        `Endpoint = ${endpoint}\n` +
        `AllowedIPs = ${this.serverParams.ALLOWED_IPS}\n`;

        try {
            writeFileSync(`${homeDir}/${this.serverParams.SERVER_WG_NIC}-client-${clientName}.conf`, 
                clientConfig, 
                { encoding: 'utf8', mode: 0o644, flag: 'w' });
        } catch (err) {
            return { ok: false, msg: 'Client config save error', data: err };
        }

        // Add the client as a peer to the server
        const serverPeer = `### Client ${clientName}\n` +
        `[Peer]\n` +
        `PublicKey = ${clientPublicKey}\n` +
        `PresharedKey = ${clientPreSharedKey}\n` +
        `AllowedIPs = ${clientWgIpV4}/32,${clientWgIpV6}/128\n\n`;

        try {
            appendFileSync(`/etc/wireguard/${this.serverParams.SERVER_WG_NIC}.conf`, serverPeer, { encoding: 'utf8', flag: 'a' });
        } catch (err) {
            return { ok: false, msg: 'Server config save error', data: err };
        }

        try {
            syncWireguardConfig(this.serverParams.SERVER_WG_NIC);
        } catch (err) {
            return { ok: false, msg: 'Server config synchronization error', data: err };
        }

        this.refreshConfig();

        return { ok: true, msg: `Client ${clientName} was successfully created`, data: clientConfig };
    },
    deleteClient(clientName) {
        let existingClients = this.listClients();
        if (!existingClients.data.includes(clientName)) {
            return { ok: false, msg: 'A client with the specified name was not found' };
        }

        // Remove [Peer] block matching 'clientName'
        try {
            execSync(`sed -i "/^### Client ${clientName}\$/,/^$/d" "/etc/wireguard/${this.serverParams.SERVER_WG_NIC}.conf"`, execOptions);
        } catch (err) {
            return { ok: false, msg: 'Remove peer block from server config error', data: err };
        }

        // Remove generated client file
        const homeDir = getHomeDirForClient(clientName);
        try {
            rmSync(`${homeDir}/${this.serverParams.SERVER_WG_NIC}-client-${clientName}.conf`, { force: true });
        } catch (err) {
            return { ok: false, msg: 'Remove client config error', data: err };
        }

        // Restart wireguard to apply changes
        try {
            syncWireguardConfig(this.serverParams.SERVER_WG_NIC);
        } catch (err) {
            return { ok: false, msg: 'Server config synchronization error', data: err };
        }

        this.refreshConfig();

        return { ok: true, msg: `Client ${clientName} was successfully deleted`, data: null };
    },
    async refreshParams() {
        const data = await readFile(`/etc/wireguard/params`, 'utf8');
        this.serverParams = {};
        let preParams = data.split('\n');
        preParams.forEach(el => {
            let idx = el.indexOf('=');
            let key = el.substring(0, idx);
            let value = el.substring(idx + 1, el.length);
            this.serverParams[key.trim()] = value.trim();
        });
    },
    async refreshConfig() {
        const data = await readFile(`/etc/wireguard/${this.serverParams.SERVER_WG_NIC}.conf`, 'utf8');
        this.serverConfig = data;
    }
}

function getHomeDirForClient(clientName) {
    if (!clientName) {
        throw new Error('getHomeDirForClient() requires a client name as argument');
    }
    try {
        const DIR = opendirSync(`/home/${clientName}`);
        return DIR.path;
    } catch (err) {
        if (process.env.SUDO_USER) {
            return process.env.SUDO_USER === 'root' ? '/root' : `/home/${process.env.SUDO_USER}`;
        } else {
            return '/root';
        }
    }
}

function syncWireguardConfig(serverAddress) {
    execSync(`wg syncconf "${serverAddress}" <(wg-quick strip "${serverAddress}")`, execOptions);
}