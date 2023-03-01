# Wireguard Web GUI
This project is a web graphical implementation of [wireguard installation script](https://github.com/angristan/wireguard-install).

### Implementation relative to commit: [39caf2f](https://github.com/angristan/wireguard-install/commit/39caf2fcf6dec3b55735c70407fab0adf493e8d1)

> WireGuard is a point-to-point VPN that can be used in different ways. Here, we mean a VPN as in: the client will forward all its traffic through an encrypted tunnel to the server. The server will apply NAT to the client's traffic so it will appear as if the client is browsing the web with the server's IP.

## Features
- Listing wireguard clients
- Adding/removing clients specifying both IPv4 and IPv6 addresses
- Downloading client configuration file
- Generate client configuration QR code

## Usage
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
