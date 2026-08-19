// Displayteknik är Håkans egen tenant. Flera moduler (Founder HQ, Dagens drag) är
// hårdkodade mot DT i stället för att vara tenant-generella — den här filen är den
// enda källan för det ID:t, så alla ställen som behöver "är aktiv klient DT?" pekar
// på samma värde i stället för att var och en definierar sitt eget.
export const DT_CLIENT_ID = "a6a33547-5ca7-475f-9a62-43ff2c74d000";
