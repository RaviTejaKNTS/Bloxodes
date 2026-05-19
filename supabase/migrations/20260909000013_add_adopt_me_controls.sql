update public.wiki_pages
set
  controls_json = '[
    {"label":"Move","value":"WASD or arrow keys"},
    {"label":"Jump","value":"Space"},
    {"label":"Interact / pick up","value":"Press E when a prompt appears near a pet, baby, vehicle, shop, door, or object."},
    {"label":"Ride pet or vehicle","value":"Press E when the ride or vehicle prompt appears nearby."},
    {"label":"Drop pet or baby","value":"Backspace"},
    {"label":"Backpack","value":"B"},
    {"label":"Chat","value":"/"},
    {"label":"Zoom","value":"Mouse wheel, I, or O"},
    {"label":"Camera","value":"Hold right-click and move the mouse."},
    {"label":"Mobile and console","value":"Use the on-screen buttons or controller prompts shown by Roblox and Adopt Me."}
  ]'::jsonb
where slug = 'adopt-me';
