# Wireguard Web GUI
This project is a web graphical implementation of [wireguard installation script](https://github.com/angristan/wireguard-install).

### Implementation relative to commit: [39caf2f](https://github.com/angristan/wireguard-install/commit/39caf2fcf6dec3b55735c70407fab0adf493e8d1) ([compare to master](https://github.com/angristan/wireguard-install/compare/39caf2f..master))

> WireGuard is a point-to-point VPN that can be used in different ways. Here, we mean a VPN as in: the client will forward all its traffic through an encrypted tunnel to the server. The server will apply NAT to the client's traffic so it will appear as if the client is browsing the web with the server's IP.

## Features
- Listing wireguard clients
- Adding/removing clients specifying both IPv4 and IPv6 addresses
- Downloading client configuration file
- Generate client configuration QR code

## Usage
Install Node.js first if it is not already installed. Follow the official instructions for your operating system: [link](https://nodejs.org/en/download/package-manager/).

Clone repository, install dependencies:
```shell
cd ~
git clone https://github.com/loolzaaa/wireguard-web-gui.git && cd wireguard-web-gui
npm install
sudo npm run start
```

By default, the application is launched in *production* mode - this affects the Vue build type. If you need to load the *development* version of the Vue, then you should change the mode in file `public/env.js`:
```javascript
export default {
    mode: 'production' // 'production' or 'development'
}
```

## Service mode
You can use systemd to run this application as a service.  
First, make a local copy of the `service/ubuntu/wg-gui.service` file:
```shell
cd /path/to/app/root/directory/
cp service/ubuntu/wg-gui.service service/ubuntu/wg-gui.service.local
```
Next, in `service/ubuntu/wg-gui.service.local` change *User* and *username*:
```shell
nano service/ubuntu/wg-gui.service.local
```
```shell
User=root
WorkingDirectory=/home/username/wireguard-web-gui
ExecStart=/usr/bin/node /home/username/wireguard-web-gui/src/app.js
```
**Note:** wireguard needs root rights to work.

After that, copy the modified file to system services, run, wait a couple of moments and check:
```shell
sudo cp service/ubuntu/wg-gui.service.local /etc/systemd/system/wg-gui.service
sudo systemctl enable wg-gui.service
sudo systemctl start wg-gui.service
sudo systemctl status wg-gui.service
curl -v http://localhost:8622/clients && echo
```
