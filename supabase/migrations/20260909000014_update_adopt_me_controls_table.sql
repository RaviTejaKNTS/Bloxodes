update public.wiki_pages
set
  controls_json = '[
    {
      "action": "Move",
      "desktop": "WASD or arrow keys",
      "mobile": "On-screen joystick",
      "tablet": "On-screen joystick",
      "console": "Left stick",
      "vr": "VR movement controls"
    },
    {
      "action": "Jump",
      "desktop": "Space",
      "mobile": "Jump button",
      "tablet": "Jump button",
      "console": "Controller jump button",
      "vr": "VR jump control when available"
    },
    {
      "action": "Interact / pick up",
      "desktop": "E when a prompt appears",
      "mobile": "Tap the prompt",
      "tablet": "Tap the prompt",
      "console": "Use the prompt shown on screen",
      "vr": "Use the VR prompt shown nearby"
    },
    {
      "action": "Ride pet or vehicle",
      "desktop": "E when the ride or vehicle prompt appears",
      "mobile": "Tap the ride or vehicle prompt",
      "tablet": "Tap the ride or vehicle prompt",
      "console": "Use the ride or vehicle prompt shown on screen",
      "vr": "Use the VR ride or vehicle prompt"
    },
    {
      "action": "Drop pet or baby",
      "desktop": "Backspace",
      "mobile": "Tap Drop",
      "tablet": "Tap Drop",
      "console": "Use the drop prompt shown on screen",
      "vr": "Use the VR drop prompt when shown"
    },
    {
      "action": "Backpack",
      "desktop": "B",
      "mobile": "Backpack button",
      "tablet": "Backpack button",
      "console": "Backpack prompt or Roblox menu",
      "vr": "Backpack prompt or Roblox menu"
    },
    {
      "action": "Chat",
      "desktop": "/",
      "mobile": "Chat button",
      "tablet": "Chat button",
      "console": "Roblox chat when available",
      "vr": "Roblox chat when available"
    },
    {
      "action": "Zoom",
      "desktop": "Mouse wheel, I, or O",
      "mobile": "Pinch the screen",
      "tablet": "Pinch the screen",
      "console": "Controller camera controls",
      "vr": "VR camera view"
    },
    {
      "action": "Camera",
      "desktop": "Hold right-click and move the mouse",
      "mobile": "Drag the screen",
      "tablet": "Drag the screen",
      "console": "Right stick",
      "vr": "Move your headset or VR controller aim"
    }
  ]'::jsonb
where slug = 'adopt-me';
