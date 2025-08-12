

using System;
using Dialog.DialogType;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

public class DialogTypeConverter : JsonConverter
{
    public override bool CanConvert(Type objectType)
    {
        return typeof(DialogTypeMain).IsAssignableFrom(objectType);
    }

    public override object ReadJson(JsonReader reader, Type objectType, object existingValue, JsonSerializer serializer)
    {
        JObject jsonObject = JObject.Load(reader);
        string dialogTypeString = jsonObject["type"]?.ToString(); // JSON의 "type" 필드 읽기

        DialogTypeMain dialog;

        // "type" 필드 값에 따라 적절한 자식 클래스 인스턴스 생성
        switch (dialogTypeString)
        {
            case "minecraft:confirmation":
                dialog = new ConfirmationDialog();
                break;
            case "minecraft:multi_action":
                dialog = new MultiActionDialog();
                break;
            case "minecraft:notice":
                dialog = new NoticeDialog();
                break;
            case "minecraft:dialog_list":
                dialog = new DialogListDialog();
                break;
            // 다른 자식 클래스들 추가
            default:
                throw new JsonSerializationException($"Unknown or missing 'type' field in JSON: {dialogTypeString}");
        }

        // 생성된 인스턴스에 나머지 JSON 데이터 채우기
        serializer.Populate(jsonObject.CreateReader(), dialog);
        return dialog;
    }

    public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer)
    {
        // 시리얼라이즈는 [JsonProperty(Order)]와 DefaultValueHandling으로 제어 가능
        // 아니면 여기서 직접 JObject를 구성하여 순서를 강제할 수 있습니다.
        JObject jsonObject = JObject.FromObject(value, serializer);

        // type 필드가 readonly string type; 이고 생성자로 설정된다면
        // JObject.FromObject에서 이미 포함될 것입니다.
        // 만약 type 필드가 [JsonIgnore]라면 여기서 수동으로 추가해야 합니다.
        // DialogTypeMain dialogValue = (DialogTypeMain)value;
        // jsonObject["type"] = dialogValue.type;

        jsonObject.WriteTo(writer);
    }
}