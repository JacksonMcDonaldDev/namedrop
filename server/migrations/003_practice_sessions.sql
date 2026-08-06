-- practice_sessions (drill lifecycle, keyed by deck — fully separate from SM-2 study_sessions)
CREATE TABLE practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_practice_sessions_deck_id ON practice_sessions (deck_id);

-- practice_events (immutable got-it/missed-it log per deck_people row)
CREATE TABLE practice_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
    deck_person_id UUID NOT NULL REFERENCES deck_people(id) ON DELETE CASCADE,
    result TEXT NOT NULL CHECK (result IN ('got_it', 'missed_it')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_practice_events_session_id ON practice_events (session_id);
