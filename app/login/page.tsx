// Bekvämlighets-redirect: många skriver den engelska adressen /login.
// Skicka dem alltid till den riktiga inloggningssidan /logga-in.
import { redirect } from "next/navigation";

export default function LoginAlias() {
  redirect("/logga-in");
}
