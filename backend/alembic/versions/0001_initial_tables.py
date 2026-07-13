"""initial tables

Revision ID: 0001
Revises: 
Create Date: 2026-07-13 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Users
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('password_hash', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_id', 'users', ['id'], unique=False)

    # Avatars
    op.create_table(
        'avatars',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('canonical_url', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_avatars_id', 'avatars', ['id'], unique=False)
    op.create_index('ix_avatars_user_id', 'avatars', ['user_id'], unique=False)

    # Avatar Source Images
    op.create_table(
        'avatar_source_images',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('avatar_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('avatars.id', ondelete='CASCADE'), nullable=False),
        sa.Column('file_url', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_avatar_source_images_id', 'avatar_source_images', ['id'], unique=False)

    # Source Images
    op.create_table(
        'source_images',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('original_url', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_source_images_id', 'source_images', ['id'], unique=False)
    op.create_index('ix_source_images_user_id', 'source_images', ['user_id'], unique=False)

    # Garments
    op.create_table(
        'garments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('source_image_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('source_images.id', ondelete='SET NULL'), nullable=True),
        sa.Column('bounding_box', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('crop_url', sa.String(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('attributes', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('style_attributes', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('embedding_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_garments_id', 'garments', ['id'], unique=False)
    op.create_index('ix_garments_user_id', 'garments', ['user_id'], unique=False)
    op.create_index('ix_garments_category', 'garments', ['category'], unique=False)

    # Outfits
    op.create_table(
        'outfits',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('avatar_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('avatars.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('pose', sa.String(), nullable=False, server_default='studio_front'),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_outfits_id', 'outfits', ['id'], unique=False)
    op.create_index('ix_outfits_user_id', 'outfits', ['user_id'], unique=False)

    # Outfit Garments
    op.create_table(
        'outfit_garments',
        sa.Column('outfit_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('outfits.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('garment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('garments.id', ondelete='CASCADE'), primary_key=True),
    )

    # Renders
    op.create_table(
        'renders',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('outfit_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('outfits.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('result_url', sa.String(), nullable=True),
        sa.Column('prompt_used', sa.String(), nullable=True),
        sa.Column('error_message', sa.String(), nullable=True),
        sa.Column('is_saved', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_renders_id', 'renders', ['id'], unique=False)
    op.create_index('ix_renders_user_id', 'renders', ['user_id'], unique=False)
    op.create_index('ix_renders_is_saved', 'renders', ['is_saved'], unique=False)


def downgrade() -> None:
    op.drop_table('renders')
    op.drop_table('outfit_garments')
    op.drop_table('outfits')
    op.drop_table('garments')
    op.drop_table('source_images')
    op.drop_table('avatar_source_images')
    op.drop_table('avatars')
    op.drop_table('users')
