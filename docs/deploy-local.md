# Deploy local com Portainer

## 1) Variaveis base
Use o ficheiro .env.example como base e defina as variaveis no Portainer Stack.

Obrigatorio:
- INVODATA_JWT_SECRET
- ADMIN_STATS_PASSWORD
- VITE_API_URL
- INVODATA_FRONTEND_URL
- INVODATA_LOCAL_DOMAIN (ou INVODATA_DOMAIN se for publico)

## 2) NFS (Synology)
1. No Synology, ative NFS e crie uma pasta partilhada para o InvoData.
2. Defina:
   - NFS_SERVER=IP do Synology
   - NFS_EXPORT=/volume1/invodata (ajuste para o seu caminho)
3. O backend e a API Python vao montar o NFS em /data/local.

## 3) HTTP local
- Para LAN, defina INVODATA_LOCAL_DOMAIN, por exemplo: invodata.local
- Adicione o hostname no DNS local ou no /etc/hosts
- Abra http://INVODATA_LOCAL_DOMAIN

## 4) HTTPS publico (Caddy + Lets Encrypt)
- Defina INVODATA_DOMAIN com o dominio publico
- Garanta que o DNS aponta para o seu servidor
- O Caddy trata do certificado automaticamente

## 5) Primeiro arranque
1. Suba o stack no Portainer.
2. Abra http://INVODATA_LOCAL_DOMAIN ou https://INVODATA_DOMAIN
3. Vai aparecer a pagina de configuracao inicial.
4. Defina a password de admin, escolha Local ou NFS e ative/desative IA.

Notas:
- Para ficheiros em NFS sem encriptacao, escolha NFS na pagina de configuracao inicial.
- O frontend usa VITE_API_URL e o backend usa INVODATA_FRONTEND_URL. Ambos devem apontar para o mesmo host.
