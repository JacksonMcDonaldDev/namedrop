-- decks
CREATE TABLE decks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('prebuilt', 'smart')),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- deck_people (prebuilt deck rosters)
CREATE TABLE deck_people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT,
    photo_path TEXT,
    mnemonic TEXT,
    attribution_author TEXT,
    attribution_source_url TEXT,
    attribution_license TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deck_people_deck_id ON deck_people (deck_id);
