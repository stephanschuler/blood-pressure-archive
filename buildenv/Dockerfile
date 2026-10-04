# amd64, weil Google aapt2 für Linux nur als x86_64 liefert; läuft auf Apple Silicon über Rosetta.
FROM --platform=linux/amd64 node:22-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-17-jdk-headless unzip rsync \
    && rm -rf /var/lib/apt/lists/*
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools
RUN mkdir -p $ANDROID_HOME/cmdline-tools \
    && curl -fsSL -o /tmp/tools.zip https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip \
    && unzip -q /tmp/tools.zip -d $ANDROID_HOME/cmdline-tools && mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest \
    && rm /tmp/tools.zip \
    && yes | sdkmanager --licenses >/dev/null && sdkmanager "platform-tools" >/dev/null
# Weitere SDK-Teile (Plattform, Build-Tools, NDK) lädt Gradle beim ersten Build selbst nach.
WORKDIR /work
