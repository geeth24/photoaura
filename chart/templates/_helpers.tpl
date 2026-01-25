{{/*
Full image path
*/}}
{{- define "fullImage" -}}
{{ .registry }}/{{ .repository }}:{{ .tag }}
{{- end }}

{{/*
Database URL
*/}}
{{- define "databaseUrl" -}}
postgresql://{{ .Values.postgres.username }}:{{ .Values.postgres.password }}@{{ .Values.global.name }}-postgres:{{ .Values.postgres.port }}/{{ .Values.postgres.database }}
{{- end }}

{{/*
Redis URL
*/}}
{{- define "redisUrl" -}}
redis://{{ .Values.global.name }}-redis:{{ .Values.redis.port }}
{{- end }}


