proxy_http_version 1.1; proxy_set_header Connection ""; proxy_set_header Host $http_host;
proxy_set_header Origin $api_origin; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $forwarded_proto; proxy_read_timeout 120s; # The refresh cookie
is marked Secure in production; drop the flag so the session also # survives reloads over plain HTTP
(Tailscale/LAN). It stays HttpOnly + SameSite=Strict. proxy_cookie_flags ~ nosecure;
