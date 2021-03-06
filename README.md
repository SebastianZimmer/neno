# NENO

NENO is a note-taking app that helps you creating your personal knowledge graph. With NENO, you retain full control over your data because you decide where it is stored: On your local machine, on a cloud storage of your choice, or even on a server under your control.

![NENO Editor view](./docs/img/editor%20view.png)
![NENO Graph view](./docs/img/graph%20view.png)

## Sponsoring

This open source software comes free of charge and is made with ❤️. If it is helpful to you, please consider [buying me a coffee](https://www.buymeacoffee.com/szimr).

[<img src="./docs/img/bmac%20button.png" alt="Buy me a coffee" width="200"/>](https://www.buymeacoffee.com/szimr)

## Getting started

There are two modes in which NENO can operate: **Server mode** and
**local mode**.

### Server mode

Server mode requires you to set up your own server.
Server mode has the advantage that you can access your data from everywhere you
want. In addition, in server mode NENO will retrieve metadata on pasted URLs
and displays them with your note.
The NENO server supports
* HTTPS and SSL certificates for secure connections
* as many users/databases as you like
* two-factor authentication with password and token

[How to setup a NENO server](./docs/SettingUpNENOServer.md)

### Local mode

In local mode, NENO stores the data in a directory of your choice on your
local machine (could be a cloud storage directory for example). This is possible
thanks to the [File System Access API](https://web.dev/file-system-access/) that is
now available in Chromium-based browsers (Chrome, Edge, Opera, ...) and
hopefully soon in Firefox, too.
In local mode, no notes data is transmitted to the server.
To run NENO in local mode, you do not need a Node.js server. You only need a
web space capable of serving static files via HTTPS.

[Deploying NENO for local mode usage](./docs/DeployNENOLocalMode.md)


## Further reading

* [Why I built NENO](https://webaudiotech.com/2021/02/13/serendipity-and-the-most-detailed-map-of-my-knowledge-that-ever-existed/)

* [How to use the Graph view](./docs/GraphViewManual.md)

* [Tips and tricks for working with NENO](./docs/TipsAndTricks.md)
