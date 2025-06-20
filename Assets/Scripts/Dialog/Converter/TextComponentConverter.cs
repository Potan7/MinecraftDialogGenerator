using System;
using System.Collections.Generic;
using Dialog.TextComponent;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

public class TextComponentConverter : JsonConverter
{
    // 이 컨버터가 어떤 타입을 변환할 수 있는지 지정합니다.
    // 여기서는 object 타입을 처리하므로 true를 반환합니다.
    public override bool CanConvert(Type objectType)
    {
        return objectType == typeof(object);
    }

    // JSON을 C# 객체로 읽어올 때 호출됩니다. (Deserialize)
    public override object ReadJson(JsonReader reader, Type objectType, object existingValue, JsonSerializer serializer)
    {
        JToken token = JToken.Load(reader); // 현재 토큰을 JToken으로 로드

        if (token.Type == JTokenType.String)
        {
            // JSON이 문자열인 경우
            return token.ToObject<string>();
        }
        else if (token.Type == JTokenType.Object)
        {
            // JSON이 객체인 경우
            return token.ToObject<TextComponentAbstract>();
        }
        else if (token.Type == JTokenType.Array)
        {
            // JSON이 배열인 경우
            return token.ToObject<List<TextComponentAbstract>>();
        }
        else if (token.Type == JTokenType.Null)
        {
            // JSON이 null인 경우
            return null;
        }

        // 지원하지 않는 토큰 타입일 경우 예외 발생 또는 기본값 처리
        throw new JsonSerializationException($"Unexpected JSON token type: {token.Type} for a TextComponent field.");
    }

    // C# 객체를 JSON으로 내보낼 때 호출됩니다. (Serialize)
    public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer)
    {
        // C# 객체의 실제 런타임 타입을 확인하여 적절하게 시리얼라이즈합니다.
        if (value is string stringValue)
        {
            writer.WriteValue(stringValue); // 문자열로 내보내기
        }
        else if (value is TextComponentAbstract objectValue)
        {
            serializer.Serialize(writer, objectValue); // 객체로 내보내기
        }
        else if (value is List<TextComponentAbstract> listValue)
        {
            serializer.Serialize(writer, listValue); // 배열로 내보내기
        }
        else if (value == null)
        {
            writer.WriteNull(); // null로 내보내기
        }
        else
        {
            throw new JsonSerializationException($"Unsupported type for a TextComponent field: {value.GetType()}");
        }
    }
}