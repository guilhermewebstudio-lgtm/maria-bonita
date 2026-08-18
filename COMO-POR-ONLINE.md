# Maria Bonita — como pôr isto online a sério

Isto é um site + servidor completo e já testado: contas de utilizador, login,
recuperação de password por email real, e marcações guardadas numa base de
dados verdadeira (ficam mesmo gravadas, não desaparecem ao recarregar a página).

Não precisas de mexer em nenhum ficheiro de código. Só precisas de **pôr isto
a correr num sítio ligado à internet** — isso é feito por fora, num site de
alojamento, com alguns cliques.

## Passo a passo (sem tocar em código)

1. Cria uma conta gratuita em **render.com** (ou Railway, é parecido).
2. Cria um "New Web Service" e escolhe "Deploy from a folder / repo" —
   fazes upload desta pasta toda (`maria-bonita-server`).
3. Nas definições, o "Start Command" é: `npm start`
4. Em "Environment Variables" (variáveis de ambiente), copia o que está no
   ficheiro `.env.example` e preenche lá diretamente no site do Render —
   isto substitui o ficheiro `.env` (esse ficheiro é só para testares no teu
   computador; em produção usa-se sempre as variáveis do próprio alojamento).
   - `JWT_SECRET`: qualquer frase longa e aleatória tua
   - `FRONTEND_URL`: o endereço que o Render te der (ex: `https://maria-bonita.onrender.com`)
5. Carrega em "Deploy". Em 2-3 minutos tens um endereço público
   (ex: `https://maria-bonita.onrender.com`) onde o site E a API já estão
   os dois a funcionar — é a mesma coisa que testámos aqui, só que acessível
   a partir de qualquer telemóvel ou computador, não só do teu.

## Email a sério (opcional, mas recomendado)

Sem isto, o pedido de recuperação de password funciona na mesma, só que o
"email" fica só registado nos logs do servidor em vez de chegar à caixa de
entrada da pessoa.

Para ser mesmo enviado:
1. Cria conta gratuita em **brevo.com** (tem plano grátis com envio de email).
2. Lá dentro, obténs um "SMTP Host", "SMTP User" e "SMTP Password".
3. Preenches essas 3 variáveis (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`) nas
   variáveis de ambiente do Render, tal como fizeste no passo 4 acima.

## O que já está feito e testado

- Registo de conta com password encriptada (nunca fica em texto simples)
- Login com sessão que fica guardada no browser
- Recuperação de password com hiperligação por email a sério, com validade de 1 hora
- Criar marcações (guardadas mesmo na base de dados)
- Ver histórico de marcações (futuras e passadas)
- Cancelar marcações futuras
- Todas as validações do lado do servidor (não dá para "make believe" nos
  pedidos — datas passadas, serviços inválidos e afins são recusados mesmo
  que alguém tente contornar o site)

## Ligar a um domínio próprio (mariabonita.pt, por exemplo)

Isso também se faz sem código — dentro do Render, em "Custom Domain",
adicionas o domínio que compraste (ex: na Namecheap/GoDaddy) e eles dão-te
uns registos DNS para colar lá. Se quiseres, ajudo-te nesse passo quando lá
chegares.
