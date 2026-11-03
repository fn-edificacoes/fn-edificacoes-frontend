/* Endereços públicos que saem do sistema em mensagens para o cliente (WhatsApp do laudo).
   Fixos de propósito, e não window.location: quem gera a mensagem pode estar rodando o app em
   localhost, e o cliente precisa receber o endereço de produção. Mudou o domínio ou a rota,
   muda só aqui. */
export const SISTEMA_URL = "https://sistema.fnedificacoes.com.br";

/* Área do Cliente: a tela de entrada do sistema. O cliente entra com o e-mail cadastrado
   (primeiro acesso e senha esquecida pelo "Receba um link por e-mail") e baixa o laudo ali. */
export const AREA_CLIENTE_URL = `${SISTEMA_URL}/`;

/* Loja FN Home: rota pública do próprio sistema (?pagina=fn-home), aberta a todos, sem login. */
export const FN_HOME_URL = `${SISTEMA_URL}/?pagina=fn-home`;
