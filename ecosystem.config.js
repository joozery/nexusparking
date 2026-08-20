module.exports = {
  apps: [
    {
      name:   'parking-app',
      script: 'node_modules/next/dist/bin/next',
      args:   'start',
      cwd:    'C:\\nexusparking-main',
      env: {
        NODE_ENV: 'production',
        PORT:     3000,
      },
    },
    // barrier-server is intentionally NOT auto-started here.
    // A20 Park still runs the legacy Visitor.exe in parallel and it owns COM3 —
    // COM3 is exclusive-lock on Windows, so if this app auto-starts it grabs the
    // port out from under Visitor.exe and Visitor.exe pops up a
    // "cannot open barrier" warning. Re-enable only after real cutover
    // (Visitor.exe fully retired). See barrier_server.js for the serial logic.
    // {
    //   name:   'barrier-server',
    //   script: 'C:\\nexusparking-main\\barrier_server.js',
    //   cwd:    'C:\\nexusparking-main',
    // },
    {
      name:        'go2rtc',
      script:      'C:\\nexusparking-main\\go2rtc\\go2rtc.exe',
      args:        '-config go2rtc.yaml',
      cwd:         'C:\\nexusparking-main\\go2rtc',
      interpreter: 'none',
    },
  ],
}
