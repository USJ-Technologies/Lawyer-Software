insert into case_type (code, label) values
  ('civil', 'Civil'),
  ('criminal', 'Criminal'),
  ('bail', 'Bail'),
  ('writ', 'Writ Petition'),
  ('family', 'Family/Matrimonial'),
  ('other', 'Other');

insert into court (name, level, state) values
  ('Supreme Court of India', 'supreme_court', null),
  ('Delhi High Court', 'high_court', 'Delhi'),
  ('Bombay High Court', 'high_court', 'Maharashtra');
