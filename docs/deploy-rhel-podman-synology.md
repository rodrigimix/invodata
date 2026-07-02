# Deploy em RHEL com Podman + backup SQL para Synology

Guia rapido para correr o InvoData no home server com Podman e guardar backups MariaDB no Synology.

## 0) Configuracao automatica (recomendado)

Depois de clonar o repositorio, execute:

```bash
cd /srv/invodata/invodata
chmod +x scripts/setup-podman-home.sh
./scripts/setup-podman-home.sh \
  --nfs-server 192.168.1.20 \
  --nfs-export /volume1/invodata \
  --jwt-secret 'troca-isto' \
  --admin-password 'troca-isto' \
  --domain invodata.local \
  --yes
```

O script cria/atualiza `.env`, valida `podman compose config` e corre `DRY_RUN` do backup.

## 1) Instalar Podman no RHEL

```bash
sudo dnf -y install podman podman-compose
podman --version
podman compose version
```

Se for usar restart da stack via backend, ative o socket API do Podman (rootful):

```bash
sudo systemctl enable --now podman.socket
sudo systemctl status podman.socket --no-pager
```

## 2) Montar Synology (NFS)

```bash
sudo mkdir -p /mnt/synology
```

Exemplo em `/etc/fstab`:

```fstab
192.168.1.20:/volume1/invodata /mnt/synology nfs4 rw,hard,timeo=600,retrans=2,_netdev,noatime 0 0
```

```bash
sudo mount -a
mountpoint /mnt/synology
```

## 3) Configurar `.env`

```bash
cd /srv/invodata/invodata
cp .env.example .env
```

Ajuste no `.env`:

- `CONTAINER_CLI=podman`
- `CONTAINER_SOCK=/run/podman/podman.sock`
- `NFS_SERVER`, `NFS_EXPORT`
- `BACKUP_DIR=/mnt/synology/invodata/backups`
- `INVODATA_JWT_SECRET` e `ADMIN_STATS_PASSWORD`

## 4) Subir stack com Podman

```bash
cd /srv/invodata/invodata
podman compose -f docker-compose.yml -f docker-compose.nfs.yml up -d --build
podman ps
```

## 5) Backup MariaDB para Synology

Teste sem executar dump real:

```bash
cd /srv/invodata/invodata
DRY_RUN=true bash scripts/backup.sh
```

Backup real:

```bash
cd /srv/invodata/invodata
bash scripts/backup.sh
ls -lh /mnt/synology/invodata/backups
```

## 6) Agendar backup diario (cron)

```bash
crontab -e
```

```cron
30 3 * * * cd /srv/invodata/invodata && /usr/bin/bash scripts/backup.sh >> /var/log/invodata-backup.log 2>&1
```

## 7) Restore MariaDB

```bash
gzip -dc /mnt/synology/invodata/backups/mariadb_invodata_YYYYmmdd_HHMMSS.sql.gz \
  | podman exec -i invodata-mariadb mariadb -u root -p"$MARIADB_ROOT_PASSWORD" invodata
```

