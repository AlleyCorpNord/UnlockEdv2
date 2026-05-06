# Canvas LMS Local Docker: Configure Admin Login

When running Canvas LMS from the official `instructure/canvas-lms` repository, there is usually no fixed default admin username/password.

The admin account is created during the database setup step, or manually through the Canvas rake task:

```bash
bundle exec rake db:configure_admin
```

When using Docker, run it inside the running `web` container.

## 1. Exec into the running Canvas container

From the Canvas LMS repo root:

```bash
docker compose exec web bash
```

Then run:

```bash
bundle exec rake db:configure_admin
```

This should prompt for the admin email and password.

## 2. If `Psych::AliasesNotEnabled` occurs

You may see an error like:

```txt
Psych::AliasesNotEnabled: Alias parsing was not enabled.
```

This happens because Canvas loads a YAML file that uses YAML anchors/aliases, but the Ruby YAML parser is rejecting aliases by default.

Patch the Canvas rake task locally:

```bash
ruby -pi -e 'gsub("YAML.load_file(security_conf_path)", "YAML.load_file(security_conf_path, aliases: true)")' lib/tasks/db_load_data.rake
```

Then rerun:

```bash
bundle exec rake db:configure_admin
```

## 3. If Canvas says `Please configure domain.yml`

You may see:

```txt
rake aborted!
Please configure domain.yml
```

This means `config/domain.yml` is missing or not configured for the current Rails environment.

Copy the Docker-provided config file:

```bash
cp docker-compose/config/domain.yml config/domain.yml
```

Verify it:

```bash
cat config/domain.yml
```

It should contain entries for the environment Canvas is running under, commonly `development`:

```yaml
production:
  domain: 'canvas.docker'

test:
  domain: localhost

development:
  domain: 'canvas.docker'
```

Check the current Rails environment if needed:

```bash
echo $RAILS_ENV
```

Make sure `config/domain.yml` has a matching top-level key.

## 4. Run the admin configuration again

After fixing the YAML alias issue and ensuring `domain.yml` exists:

```bash
bundle exec rake db:configure_admin
```

Enter the admin email and password when prompted.

Then log in at:

```txt
http://canvas.docker/
```

using the email/password you configured.

## Notes

The Docker Compose warning below is not the cause of the Canvas rake failure:

```txt
the attribute `version` is obsolete, it will be ignored
```

It can be fixed later by removing the top-level `version:` field from `docker-compose.override.yml`.
