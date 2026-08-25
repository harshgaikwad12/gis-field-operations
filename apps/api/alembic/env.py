from logging.config import fileConfig
import os

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config
from sqlalchemy import pool

from app.db.base import Base
from app.models.master_meter import MasterMeter
from app.models.pending_consumer import PendingConsumer
from app.models.officer import Officer
from app.models.zone import Zone
from app.models.area import Area
from app.models.field_area import FieldArea



load_dotenv(".env")

config = context.config


if config.config_file_name is not None:
    fileConfig(config.config_file_name)


target_metadata = Base.metadata


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured.")

    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
    elif database_url.startswith("postgresql://") and not database_url.startswith("postgresql+"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

    if "channel_binding=require&" in database_url:
        database_url = database_url.replace("channel_binding=require&", "")
    elif "?channel_binding=require" in database_url:
        database_url = database_url.replace("?channel_binding=require", "")

    return database_url


def include_object(
    object,
    name,
    type_,
    reflected,
    compare_to,
):
    if type_ == "table" and reflected and name == "spatial_ref_sys":
        return False

    return True


def run_migrations_offline() -> None:
    url = get_database_url()

    context.configure(
        url=url,
        target_metadata=target_metadata,
        include_object=include_object,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(
        config.config_ini_section
    )

    if configuration is None:
        raise RuntimeError(
            "Alembic configuration section is missing."
        )

    configuration["sqlalchemy.url"] = get_database_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()