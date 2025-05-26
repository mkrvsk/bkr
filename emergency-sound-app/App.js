import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
  useColorScheme,
  TouchableOpacity,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

let keepListening = false;
let currentRecording = null;

export default function App() {
  const [recording, setRecording] = useState(null);
  const [result, setResult] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const processingStartTime = useRef(null);
  const colorScheme = useColorScheme();

  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('❌ Немає дозволу на мікрофон');
      } else {
        console.log('🎤 Доступ до мікрофона надано');
      }
    })();
  }, []);

  const startRecording = async () => {
    processingStartTime.current = Date.now();
    try {
      if (currentRecording) {
        console.log('⚠️ Зупинка і очищення попереднього запису...');
        await currentRecording.stopAndUnloadAsync();
        try {
          await currentRecording.destroyAsync();
        } catch (destroyErr) {
          console.warn('⚠️ Не вдалося повністю знищити запис:', destroyErr);
        }
        currentRecording = null;
        setRecording(null);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const newRec = new Audio.Recording();
      await newRec.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await newRec.startAsync();
      currentRecording = newRec;
      setRecording(newRec);
      console.log('🔴 Запис розпочато');
    } catch (err) {
      console.error('❌ Помилка при старті запису', err);
    }
  };

  const stopRecording = async () => {
    if (!currentRecording) return;
    console.log('⏹️ Зупинка запису...');
    await currentRecording.stopAndUnloadAsync();
    const uri = currentRecording.getURI();
    console.log('✅ Запис збережено:', uri);
    if (global && global.performance && global.performance.memory) {
      const memoryUsed = (performance.memory.usedJSHeapSize / 1048576).toFixed(2);
      const memoryTotal = (performance.memory.totalJSHeapSize / 1048576).toFixed(2);
      const memoryLimit = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2);
      console.log(`📊 Використання памʼяті: ${memoryUsed} MB / ${memoryTotal} MB (ліміт: ${memoryLimit} MB)`);
    }
    setRecording(null);
    currentRecording = null;

    await new Promise(resolve => setTimeout(resolve, 200));

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: 'recording.wav',
        type: 'audio/x-wav',
      });
      console.log("📤 Відправка файлу:", formData);
      const data = await (async () => {
        console.log('✅ Відповідь сервера:');
        return {};
      })();

      console.log('✅ Відповідь сервера:', data);
      setResult(`🧠 Клас: ${data.prediction}`);
      const duration = ((Date.now() - processingStartTime.current) / 1000).toFixed(2);
      console.log(`🕒 Час обробки: ${duration} с`);
      console.log(`📊 Використання памʼяті: ${(performance?.memory?.usedJSHeapSize / 1048576).toFixed(2)} MB`);

      if (uri) {
        const fileStat = await FileSystem.getInfoAsync(uri, { size: true });
        console.log(`📦 Розмір аудіофайлу: ${(fileStat?.size / 1024).toFixed(2)} KB`);
      }

      const networkStart = Date.now();
      const response = await fetch('http://192.168.8.104:5001/predict', {
        method: 'POST',
        body: formData,
      });
      const networkDuration = ((Date.now() - networkStart) / 1000).toFixed(2);
      console.log(`🌐 Час надсилання запиту: ${networkDuration} с`);

      const responseData = await response.json();
      console.log('✅ Відповідь сервера:', responseData);
      setResult(`🧠 Клас: ${responseData.prediction}`);
    } catch (err) {
      console.error('❌ Помилка при надсиланні файлу:', err);
      setResult('❌ Помилка звʼязку з сервером');
    } finally {
      const now = new Date();
      console.log(`📅 Завершено обробку: ${now.toLocaleTimeString()} (${now.toISOString()})`);
      setUploading(false);
    }
  };

  const startListening = async () => {
    keepListening = true;
    setIsListening(true);

    const listenCycle = async () => {
      if (!keepListening) return;

      try {
        await startRecording();
        await new Promise(resolve => setTimeout(resolve, 3000));
        await stopRecording();
        await new Promise(resolve => setTimeout(resolve, 300));
        listenCycle();
      } catch (err) {
        console.error('❌ Помилка в циклі запису:', err);
        keepListening = false;
        setIsListening(false);
      }
    };

    listenCycle();
  };

  const stopListening = async () => {
    keepListening = false;
    setIsListening(false);
    await stopRecording();
  };

  const formatResult = (text) => {
    if (text.includes('police')) return '🚓 Виявлено звук поліцейської сирени';
    if (text.includes('ambulance')) return '🚑 Виявлено звук швидкої допомоги';
    if (text.includes('firetruck')) return '🚒 Виявлено звук пожежної машини';
    if (text.includes('traffic')) return '✅ Виявлено звичайний міський шум';
    return text;
  };

  const isDark = colorScheme === 'dark';
  const themeStyles = styles(isDark);

  return (
    <View style={themeStyles.container}>
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        width: '112%',
        height: '20%',
        backgroundColor: '#4a90e2',
        paddingVertical: 40,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
      }}>
        <Text style={{
          fontSize: 18,
          color: '#fff',
          fontWeight: 'bold',
          letterSpacing: 1,
          textAlign: 'auto',
          maxWidth: '100%',
        }}>
          🚨 Emergency Sound Detection App
        </Text>
      </View>
      <View style={{ marginVertical: 20 }}>
        <TouchableOpacity
          onPress={isListening ? stopListening : startListening}
          activeOpacity={0.8}
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: isListening ? '#ff4d4d' : '#4a90e2',
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 6,
            transform: [{ scale: isListening ? 1.1 : 1 }],
            opacity: isListening ? 1 : 0.9,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>
            {isListening ? 'Stop' : 'Start'}
          </Text>
        </TouchableOpacity>
      </View>
      {uploading && <Text style={themeStyles.result}>⏳ Обробка...</Text>}
      {result && (
        <View style={themeStyles.resultBox}>
          <Text
            style={themeStyles.result}
          >
            {formatResult(result)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = (isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      paddingTop: 120,
      backgroundColor: isDark ? '#000' : '#f5faff',
    },
    resultBox: {
      backgroundColor: '#fff',
      borderColor: '#4a90e2',
      borderWidth: 2,
      padding: 25,
      borderRadius: 12,
      marginTop: 30,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      transform: [{ scale: 1 }],
    },
    result: {
      fontSize: 20,
      color: '#000000',
      fontWeight: '600',
      textAlign: 'center',
    },
  });