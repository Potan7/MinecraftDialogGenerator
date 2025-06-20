using UnityEngine;
using UnityEngine.UIElements;

public class MainUiController : MonoBehaviour
{
    private UIDocument _doc;
    private Button _playButton;
    private Button _settingsButton;
    private Button _exitButton;

    void Awake()
    {
        _doc = GetComponent<UIDocument>();

        _playButton = _doc.rootVisualElement.Q<Button>("PlayButton");
        _settingsButton = _doc.rootVisualElement.Q<Button>("SettingButton");
        _exitButton = _doc.rootVisualElement.Q<Button>("ExitButton");

        _playButton.clicked += OnPlayButtonClicked;
        _settingsButton.clicked += OnSettingsButtonClicked;
        _exitButton.clicked += OnExitButtonClicked;
    }

    private void OnPlayButtonClicked()
    {
        Debug.Log("Play button clicked");
    }

    private void OnSettingsButtonClicked()
    {
        Debug.Log("Settings button clicked");
    }

    private void OnExitButtonClicked()
    {
        Debug.Log("Exit button clicked");
    }
}
