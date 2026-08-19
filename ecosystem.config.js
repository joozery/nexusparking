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
    {
      name:   'barrier-server',
      script: 'C:\\nexusparking-main\\barrier_server.js',
      cwd:    'C:\\nexusparking-main',
    },
    {
      name:        'go2rtc',
      script:      'C:\\nexusparking-main\\go2rtc\\go2rtc.exe',
      args:        '-config go2rtc.yaml',
      cwd:         'C:\\nexusparking-main\\go2rtc',
      interpreter: 'none',
    },
  ],
}
